import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue, Worker } from 'bullmq';
import type { App } from 'supertest/types.js';
import { ORDERS_QUEUE } from '../src/core/queue/queue.constants.js';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from '../src/modules/orders/domain/orders.repository.js';
import { OrderCreatedProcessor } from '../src/modules/orders/infra/order-created.processor.js';
import { loginAs } from './helpers/auth.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import { http, type Api } from './helpers/http.js';
import { resetOrdersQueue } from './helpers/reset-orders-queue.js';
import {
  createPendingOrder,
  getTestPrisma,
  resetOrdersData,
  seedTestUsers,
} from './helpers/test-db.js';
import { waitForOrderSettled } from './helpers/wait-for-order-status.js';

describe('Reserva de estoque sob concorrência (e2e)', () => {
  let app: INestApplication<App>;
  let repository: OrdersRepository;
  let ordersQueue: Queue;
  let ordersWorker: Worker;
  let api: Api;
  const prisma = getTestPrisma();

  const stockOf = async (productId: number) =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;

  beforeAll(async () => {
    app = await createE2eApp();
    repository = app.get(ORDERS_REPOSITORY);
    ordersQueue = app.get(getQueueToken(ORDERS_QUEUE));
    ordersWorker = app.get(OrderCreatedProcessor).worker;
    await seedTestUsers(prisma);
    api = http(app, await loginAs(app, 'user'));
  });

  beforeEach(async () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';
    await resetOrdersQueue(ordersQueue, ordersWorker);
    await resetOrdersData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('10 reservas simultâneas de 1 unidade com estoque 5: 5 confirmadas, 5 recusadas, estoque 0', async () => {
    const product = await prisma.product.create({
      data: { name: 'Disputado', priceCents: 100, stock: 5 },
    });
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(
        await createPendingOrder(prisma, {
          customerName: `cliente-${i}`,
          items: [{ productId: product.id, quantity: 1 }],
        }),
      );
    }

    const results = await Promise.all(ids.map((id) => repository.reserveStockAndConfirm(id)));

    expect(results.filter((r) => r === 'PROCESSED')).toHaveLength(5);
    expect(results.filter((r) => r === 'INSUFFICIENT_STOCK')).toHaveLength(5);
    expect(await stockOf(product.id)).toBe(0);
    expect(await prisma.order.count({ where: { status: 'PROCESSED' } })).toBe(5);
  });

  it('pedidos com os mesmos produtos em ordem inversa não entram em deadlock', async () => {
    const a = await prisma.product.create({ data: { name: 'A', priceCents: 100, stock: 100 } });
    const b = await prisma.product.create({ data: { name: 'B', priceCents: 100, stock: 100 } });
    const ids: number[] = [];
    for (let i = 0; i < 20; i++) {
      const pair = [
        { productId: a.id, quantity: 1 },
        { productId: b.id, quantity: 1 },
      ];
      ids.push(
        await createPendingOrder(prisma, {
          customerName: `par-${i}`,
          items: i % 2 === 0 ? pair : pair.reverse(),
        }),
      );
    }

    const results = await Promise.all(ids.map((id) => repository.reserveStockAndConfirm(id)));

    expect(results.every((r) => r === 'PROCESSED')).toBe(true);
    expect(await stockOf(a.id)).toBe(80);
    expect(await stockOf(b.id)).toBe(80);
  });

  it('reprocessar o mesmo pedido (retry) debita o estoque uma única vez', async () => {
    const product = await prisma.product.create({ data: { name: 'Retry', priceCents: 100, stock: 5 } });
    const orderId = await createPendingOrder(prisma, {
      customerName: 'retry',
      items: [{ productId: product.id, quantity: 2 }],
    });

    await expect(repository.reserveStockAndConfirm(orderId)).resolves.toBe('PROCESSED');
    await expect(repository.reserveStockAndConfirm(orderId)).resolves.toBe('NOT_PENDING');
    expect(await stockOf(product.id)).toBe(3);
  });

  it('entregas simultâneas do mesmo pedido debitam o estoque uma única vez', async () => {
    const product = await prisma.product.create({ data: { name: 'Dupla', priceCents: 100, stock: 5 } });
    const orderId = await createPendingOrder(prisma, {
      customerName: 'dupla',
      items: [{ productId: product.id, quantity: 2 }],
    });

    const results = await Promise.all([
      repository.reserveStockAndConfirm(orderId),
      repository.reserveStockAndConfirm(orderId),
    ]);

    expect(results.sort()).toEqual(['NOT_PENDING', 'PROCESSED']);
    expect(await stockOf(product.id)).toBe(3);
  });

  it('fluxo completo: dois pedidos de 3 com estoque 5 resultam em um PROCESSED e um FAILED', async () => {
    const product = await prisma.product.create({
      data: { name: 'Camiseta', priceCents: 1999, stock: 5 },
    });

    const responses = await Promise.all(
      ['Ana', 'Bia'].map((customerName) =>
        api
          .post('/orders')
          .send({ customerName, items: [{ productName: 'Camiseta', quantity: 3, price: 19.99 }] })
          .expect(202),
      ),
    );

    const orders = await Promise.all(
      responses.map((res) => waitForOrderSettled(prisma, res.body.id)),
    );

    expect(orders.map((o) => o.status).sort()).toEqual(['FAILED', 'PROCESSED']);
    expect(orders.find((o) => o.status === 'FAILED')!.failureReason).toBe('estoque insuficiente');
    expect(await stockOf(product.id)).toBe(2);
  });
});
