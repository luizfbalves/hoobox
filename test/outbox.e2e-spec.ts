import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import { createPendingOrder, getTestPrisma, resetOrdersData } from './helpers/test-db.js';
import { waitForOrderStatus } from './helpers/wait-for-order-status.js';

describe('Outbox (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createE2eApp();
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
});
