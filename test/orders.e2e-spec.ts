import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue, Worker } from 'bullmq';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { toCents } from '../src/core/utils/money.js';
import {
  ORDER_CREATED_JOB,
  ORDERS_QUEUE,
} from '../src/core/queue/queue.constants.js';
import { OrderCreatedProcessor } from '../src/modules/orders/infra/order-created.processor.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import {
  getTestPrisma,
  resetOrdersData,
  seedMinimalProducts,
} from './helpers/test-db.js';
import { resetOrdersQueue } from './helpers/reset-orders-queue.js';
import { waitForOrderStatus } from './helpers/wait-for-order-status.js';

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof getTestPrisma>;
  let ordersQueue: Queue;
  let ordersWorker: Worker;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = getTestPrisma();
    ordersQueue = app.get(getQueueToken(ORDERS_QUEUE));
    ordersWorker = app.get(OrderCreatedProcessor).worker;
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

  it('POST /orders enfileira job order.created com opções Bull no Redis', async () => {
    await ordersWorker.pause();
    try {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          customerName: 'Enfileira Test',
          items: [{ productName: 'Camiseta', quantity: 1, price: 19.99 }],
        })
        .expect(201);

      const order = await prisma.order.findFirstOrThrow();
      const job = await ordersQueue.getJob(`order-created-${order.id}`);

      expect(job).toBeDefined();
      expect(job!.name).toBe(ORDER_CREATED_JOB);
      expect(job!.data).toEqual({ orderId: order.id });
      expect(job!.opts).toMatchObject({
        jobId: `order-created-${order.id}`,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 50 },
      });
    } finally {
      await ordersWorker.resume();
    }
  });

  it('POST /orders persiste PENDING antes do worker terminar', async () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '3000';

    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'Maria Silva',
        items: [{ productName: 'Camiseta', quantity: 2, price: 19.99 }],
      })
      .expect(201);

    expect(res.body).toEqual({ status: 'ok' });

    const list = await prisma.order.findMany({ include: { items: true } });
    expect(list).toHaveLength(1);
    const orderId = list[0]!.id;

    const detail = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);

    expect(detail.body.status).toBe('PENDING');
    expect(detail.body.totalCents).toBe(2 * 1999);
    expect(detail.body.total).toBe('39.98');
  });

  it('POST /orders é processado para PROCESSED e debita estoque', async () => {
    const create = await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'João',
        items: [{ productName: 'Camiseta', quantity: 2, price: 19.99 }],
      })
      .expect(201);

    expect(create.body.status).toBe('ok');

    const order = await prisma.order.findFirstOrThrow();
    await waitForOrderStatus(app, order.id, 'PROCESSED');

    // Job concluído com sucesso é removido (removeOnComplete); ausência = uma execução bem-sucedida, sem retries.
    expect(await ordersQueue.getJob(`order-created-${order.id}`)).toBeUndefined();

    const product = await prisma.product.findFirstOrThrow({
      where: { name: 'Camiseta' },
    });
    expect(product.stock).toBe(3);
  });

  it('falha por estoque insuficiente via worker', async () => {
    const camiseta = await prisma.product.findFirstOrThrow({
      where: { name: 'Camiseta' },
    });
    await prisma.product.update({
      where: { id: camiseta.id },
      data: { stock: 0 },
    });

    await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'Ana',
        items: [{ productName: 'Camiseta', quantity: 1, price: 19.99 }],
      })
      .expect(201);

    const order = await prisma.order.findFirstOrThrow();
    await waitForOrderStatus(app, order.id, 'FAILED', {
      failureReason: 'estoque insuficiente',
    });

    // Falha de negócio não relança erro: job completa em 1 tentativa e some da fila (removeOnComplete).
    expect(await ordersQueue.getJob(`order-created-${order.id}`)).toBeUndefined();
  });

  it('falha simulada após retries Bull', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'Cliente fail test',
        items: [{ productName: 'Camiseta', quantity: 1, price: 19.99 }],
      })
      .expect(201);

    const order = await prisma.order.findFirstOrThrow();
    await waitForOrderStatus(app, order.id, 'FAILED', {
      timeoutMs: 30_000,
      failureReason: 'falha simulada no processamento',
    });

    const job = await ordersQueue.getJob(`order-created-${order.id}`);
    expect(job?.attemptsMade).toBe(3);
  });

  it('aceita total máximo do DTO (uma linha) e processa', async () => {
    const maxDtoPrice = 21_474_836;
    await prisma.product.updateMany({
      data: { stock: 10 },
    });

    await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'Teto DTO',
        items: [
          { productName: 'Camiseta', quantity: 1, price: maxDtoPrice },
        ],
      })
      .expect(201);

    const order = await prisma.order.findFirstOrThrow();
    expect(order.totalCents).toBe(toCents(maxDtoPrice));
    await waitForOrderStatus(app, order.id, 'PROCESSED');
  });

  it('rejeita total acima do limite', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'Max',
        items: [
          {
            productName: 'Camiseta',
            quantity: 2,
            price: 21_474_836,
          },
        ],
      })
      .expect(400);

    expect(await prisma.order.count()).toBe(0);
  });
});
