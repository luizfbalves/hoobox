import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { loginAs } from './helpers/auth.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import { http, type Api } from './helpers/http.js';
import { getTestPrisma, resetOrdersData, seedTestUsers } from './helpers/test-db.js';
import { waitForOrderStatus } from './helpers/wait-for-order-status.js';

describe('Reprocessamento (e2e)', () => {
  let app: INestApplication<App>;
  let asAdmin: Api;
  let asUser: Api;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await seedTestUsers(prisma);
    app = await createE2eApp();
    asAdmin = http(app, await loginAs(app, 'admin'));
    asUser = http(app, await loginAs(app, 'user'));
  });

  beforeEach(async () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';
    await resetOrdersData(prisma);
    await prisma.product.create({ data: { name: 'Camiseta', priceCents: 1999, stock: 0 } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function createFailedOrder(): Promise<number> {
    const res = await asUser
      .post('/orders')
      .send({ customerName: 'Ana', items: [{ productName: 'Camiseta', quantity: 1, price: 19.99 }] })
      .expect(202);
    await waitForOrderStatus(prisma, res.body.id, 'FAILED', {
      failureReason: 'estoque insuficiente',
    });
    return res.body.id;
  }

  it('ADMIN reprocessa pedido FAILED após reposição de estoque e ele vira PROCESSED', async () => {
    const orderId = await createFailedOrder();
    await prisma.product.update({ where: { name: 'Camiseta' }, data: { stock: 5 } });

    const res = await asAdmin.post(`/orders/${orderId}/reprocess`).expect(202);
    expect(res.body).toMatchObject({ id: orderId, status: 'PENDING' });

    const processed = await waitForOrderStatus(prisma, orderId, 'PROCESSED');
    expect(processed.failureReason).toBeNull();
    expect(await prisma.outboxEvent.count({ where: { aggregateId: orderId } })).toBe(2);
  });

  it('USER recebe 403', async () => {
    const orderId = await createFailedOrder();
    await asUser.post(`/orders/${orderId}/reprocess`).expect(403);
  });

  it('pedido que não está FAILED responde 409', async () => {
    await prisma.product.update({ where: { name: 'Camiseta' }, data: { stock: 5 } });
    const res = await asUser
      .post('/orders')
      .send({ customerName: 'Bia', items: [{ productName: 'Camiseta', quantity: 1, price: 19.99 }] })
      .expect(202);
    await waitForOrderStatus(prisma, res.body.id, 'PROCESSED');

    await asAdmin.post(`/orders/${res.body.id}/reprocess`).expect(409);
  });

  it('pedido inexistente responde 404', async () => {
    await asAdmin.post('/orders/999999/reprocess').expect(404);
  });

  it('dois reprocessamentos simultâneos: um 202, um 409 e um único evento novo', async () => {
    const orderId = await createFailedOrder();

    const statuses = (
      await Promise.all([
        asAdmin.post(`/orders/${orderId}/reprocess`),
        asAdmin.post(`/orders/${orderId}/reprocess`),
      ])
    ).map((r) => r.status);

    expect(statuses.sort()).toEqual([202, 409]);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: orderId } })).toBe(2);
  });
});
