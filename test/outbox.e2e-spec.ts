import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { App } from 'supertest/types.js';
import { ORDERS_QUEUE } from '../src/core/queue/queue.constants.js';
import { loginAs } from './helpers/auth.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import { http, type Api } from './helpers/http.js';
import {
  createPendingOrder,
  getTestPrisma,
  resetOrdersData,
  seedTestUsers,
} from './helpers/test-db.js';
import { waitFor } from './helpers/wait-for.js';
import { waitForOrderStatus } from './helpers/wait-for-order-status.js';

describe('Outbox (e2e)', () => {
  let app: INestApplication<App>;
  let ordersQueue: Queue;
  let api: Api;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createE2eApp();
    ordersQueue = app.get(getQueueToken(ORDERS_QUEUE));
    await seedTestUsers(prisma);
    api = http(app, await loginAs(app, 'user'));
  });

  beforeEach(async () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';
    await resetOrdersData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('evento gravado e nunca publicado (crash entre commit e fila) é publicado e processado', async () => {
    const product = await prisma.product.create({
      data: { name: 'Órfão', priceCents: 100, stock: 5 },
    });
    const orderId = await createPendingOrder(prisma, {
      customerName: 'Sem job',
      items: [{ productId: product.id, quantity: 1 }],
    });
    await prisma.outboxEvent.create({
      data: {
        aggregateId: orderId,
        eventType: 'order.created',
        payload: { orderId, correlationId: 'orfao-1' },
      },
    });

    await waitForOrderStatus(prisma, orderId, 'PROCESSED');

    const outbox = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: orderId } });
    expect(outbox.publishedAt).not.toBeNull();
  });

  it('com Redis indisponível (publish travado) POST /orders continua respondendo 202 rápido e a falha fica registrada', async () => {
    await prisma.product.create({
      data: { name: 'Caneca', priceCents: 1500, stock: 5 },
    });
    const body = (customerName: string) => ({
      customerName,
      items: [{ productName: 'Caneca', quantity: 1, price: 15 }],
    });

    const previousTimeout = process.env.OUTBOX_PUBLISH_TIMEOUT_MS;
    process.env.OUTBOX_PUBLISH_TIMEOUT_MS = '1500';
    const addSpy = vi
      .spyOn(ordersQueue, 'add')
      .mockImplementation(() => new Promise(() => {}));
    try {
      const first = await api.post('/orders').send(body('Redis Fora 1')).expect(202);

      await waitFor(async () => addSpy.mock.calls.length >= 1, {
        description: 'relay tentar publicar',
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      const startedAt = Date.now();
      const second = await api.post('/orders').send(body('Redis Fora 2')).expect(202);
      const elapsedMs = Date.now() - startedAt;
      expect(elapsedMs).toBeLessThan(1000);

      await waitFor(
        async () => {
          const row = await prisma.outboxEvent.findFirst({
            where: { aggregateId: first.body.id },
          });
          return row && row.attempts >= 1 && row.lastError?.includes('publish timeout')
            ? row
            : null;
        },
        { description: 'falha de publicação registrada no outbox' },
      );

      addSpy.mockRestore();

      await waitForOrderStatus(prisma, first.body.id, 'PROCESSED');
      await waitForOrderStatus(prisma, second.body.id, 'PROCESSED');
    } finally {
      addSpy.mockRestore();
      if (previousTimeout === undefined) {
        delete process.env.OUTBOX_PUBLISH_TIMEOUT_MS;
      } else {
        process.env.OUTBOX_PUBLISH_TIMEOUT_MS = previousTimeout;
      }
    }
  });
});
