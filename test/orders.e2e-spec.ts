import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue, Worker } from 'bullmq';
import type { App } from 'supertest/types.js';
import { toCents } from '../src/core/utils/money.js';
import {
  ORDER_CREATED_JOB,
  ORDERS_QUEUE,
} from '../src/core/queue/queue.constants.js';
import { OrderCreatedProcessor } from '../src/modules/orders/infra/order-created.processor.js';
import { loginAs } from './helpers/auth.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import { http, type Api } from './helpers/http.js';
import {
  getTestPrisma,
  resetOrdersData,
  seedMinimalProducts,
  seedTestUsers,
} from './helpers/test-db.js';
import { resetOrdersQueue } from './helpers/reset-orders-queue.js';
import { waitFor } from './helpers/wait-for.js';
import { waitForOrderStatus } from './helpers/wait-for-order-status.js';

const camiseta = (quantity: number, price = 19.99) => ({
  productName: 'Camiseta',
  quantity,
  price,
});

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof getTestPrisma>;
  let ordersQueue: Queue;
  let ordersWorker: Worker;
  let api: Api;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = getTestPrisma();
    ordersQueue = app.get(getQueueToken(ORDERS_QUEUE));
    ordersWorker = app.get(OrderCreatedProcessor).worker;
    await seedTestUsers(prisma);
    api = http(app, await loginAs(app, 'user'));
  });

  beforeEach(async () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';
    await resetOrdersQueue(ordersQueue, ordersWorker);
    await resetOrdersData(prisma);
    await seedMinimalProducts(prisma, [
      { name: 'Camiseta', priceCents: 1999, stock: 5 },
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /orders responde 202, grava evento no outbox e o relay publica o job', async () => {
    await ordersWorker.pause();
    try {
      const res = await api
        .post('/orders')
        .set('x-correlation-id', 'corr-enfileira-1')
        .send({ customerName: 'Enfileira Test', items: [camiseta(1)] })
        .expect(202);

      expect(res.body).toEqual({
        id: expect.any(Number),
        status: 'PENDING',
        correlationId: 'corr-enfileira-1',
      });

      const outbox = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: res.body.id },
      });
      expect(outbox.eventType).toBe(ORDER_CREATED_JOB);
      expect(outbox.payload).toEqual({
        orderId: res.body.id,
        correlationId: 'corr-enfileira-1',
      });

      const job = await waitFor(() => ordersQueue.getJob(`outbox-${outbox.id}`), {
        description: 'job publicado pelo relay',
      });
      expect(job.name).toBe(ORDER_CREATED_JOB);
      expect(job.data).toEqual({ orderId: res.body.id, correlationId: 'corr-enfileira-1' });
      expect(job.opts).toMatchObject({
        jobId: `outbox-${outbox.id}`,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 50 },
      });

      await waitFor(
        async () =>
          (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } }))
            .publishedAt,
        { description: 'published_at preenchido' },
      );
    } finally {
      await ordersWorker.resume();
    }
  });

  it('GET /orders/:id mostra PENDING antes do worker terminar', async () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '3000';

    const res = await api
      .post('/orders')
      .send({ customerName: 'Maria Silva', items: [camiseta(2)] })
      .expect(202);

    const detail = await api.get(`/orders/${res.body.id}`).expect(200);
    expect(detail.body.status).toBe('PENDING');
    expect(detail.body.totalCents).toBe(2 * 1999);
    expect(detail.body.total).toBe('39.98');
    expect(detail.body.correlationId).toBe(res.body.correlationId);
  });

  it('pedido é processado para PROCESSED e debita estoque', async () => {
    const res = await api
      .post('/orders')
      .send({ customerName: 'João', items: [camiseta(2)] })
      .expect(202);

    await waitForOrderStatus(prisma, res.body.id, 'PROCESSED');

    const outbox = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: res.body.id },
    });
    expect(await ordersQueue.getJob(`outbox-${outbox.id}`)).toBeUndefined();

    const product = await prisma.product.findUniqueOrThrow({ where: { name: 'Camiseta' } });
    expect(product.stock).toBe(3);
  });

  it('estoque insuficiente vira FAILED sem retry', async () => {
    await prisma.product.update({ where: { name: 'Camiseta' }, data: { stock: 0 } });

    const res = await api
      .post('/orders')
      .send({ customerName: 'Ana', items: [camiseta(1)] })
      .expect(202);

    await waitForOrderStatus(prisma, res.body.id, 'FAILED', {
      failureReason: 'estoque insuficiente',
    });

    const outbox = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: res.body.id },
    });
    expect(await ordersQueue.getJob(`outbox-${outbox.id}`)).toBeUndefined();
  });

  it('falha simulada esgota 3 tentativas e vira FAILED com motivo', async () => {
    const res = await api
      .post('/orders')
      .send({ customerName: 'Cliente fail test', items: [camiseta(1)] })
      .expect(202);

    await waitForOrderStatus(prisma, res.body.id, 'FAILED', {
      timeoutMs: 30_000,
      failureReason: 'falha simulada no processamento',
    });

    const outbox = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: res.body.id },
    });
    const job = await ordersQueue.getJob(`outbox-${outbox.id}`);
    expect(job?.attemptsMade).toBe(3);
  });

  it('GET /orders pagina com page e limit', async () => {
    await ordersWorker.pause();
    try {
      for (const name of ['P1', 'P2', 'P3']) {
        await api.post('/orders').send({ customerName: name, items: [camiseta(1)] }).expect(202);
      }

      const page2 = await api.get('/orders?page=2&limit=2').expect(200);
      expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
      expect(page2.body.data).toHaveLength(1);

      await api.get('/orders?limit=101').expect(400);
      await api.get('/orders?page=0').expect(400);
    } finally {
      await ordersWorker.resume();
    }
  });

  it('GET /orders desempata createdAt igual por id desc (paginação determinística)', async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { name: 'Camiseta' } });
    const customer = await prisma.customer.create({ data: { name: 'Empate' } });
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          totalCents: 1999,
          createdAt,
          items: { create: [{ productId: product.id, quantity: 1, priceCents: 1999 }] },
        },
      });
      ids.push(order.id);
    }

    const page1 = await api.get('/orders?page=1&limit=2').expect(200);
    const page2 = await api.get('/orders?page=2&limit=2').expect(200);
    const listed = [...page1.body.data, ...page2.body.data].map((o: { id: number }) => o.id);
    expect(listed).toEqual([...ids].sort((a, b) => b - a));
  });

  it('POSTs simultâneos do mesmo cliente novo criam um único cliente', async () => {
    await ordersWorker.pause();
    try {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          api.post('/orders').send({ customerName: 'Cliente Novo', items: [camiseta(1)] }),
        ),
      );
      expect(responses.map((r) => r.status)).toEqual([202, 202, 202, 202, 202]);
      expect(await prisma.customer.count({ where: { name: 'Cliente Novo' } })).toBe(1);
      expect(await prisma.order.count()).toBe(5);
    } finally {
      await ordersWorker.resume();
    }
  });

  it('produto inexistente responde 404 e não grava nada', async () => {
    await api
      .post('/orders')
      .send({ customerName: 'Ana', items: [{ productName: 'Nada', quantity: 1, price: 1 }] })
      .expect(404);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('aceita total máximo do DTO (uma linha) e processa', async () => {
    const maxDtoPrice = 21_474_836;
    const res = await api
      .post('/orders')
      .send({ customerName: 'Teto DTO', items: [camiseta(1, maxDtoPrice)] })
      .expect(202);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(order.totalCents).toBe(toCents(maxDtoPrice));
    await waitForOrderStatus(prisma, res.body.id, 'PROCESSED');
  });

  it('rejeita total acima do limite', async () => {
    await api
      .post('/orders')
      .send({ customerName: 'Max', items: [camiseta(2, 21_474_836)] })
      .expect(400);

    expect(await prisma.order.count()).toBe(0);
  });
});
