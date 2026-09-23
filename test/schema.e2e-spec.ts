import { getTestPrisma, resetOrdersData } from './helpers/test-db.js';

describe('Schema constraints (e2e)', () => {
  const prisma = getTestPrisma();

  beforeEach(async () => {
    await resetOrdersData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('usa estoque inicial 5 por padrão', async () => {
    const product = await prisma.product.create({
      data: { name: 'Padrão', priceCents: 100 },
    });
    expect(product.stock).toBe(5);
  });

  it('rejeita estoque negativo mesmo com UPDATE direto', async () => {
    const product = await prisma.product.create({
      data: { name: 'Pouco', priceCents: 100, stock: 1 },
    });
    await expect(
      prisma.$executeRaw`UPDATE products SET stock = stock - 2 WHERE id = ${product.id}`,
    ).rejects.toThrow();
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.stock).toBe(1);
  });

  it('rejeita produto com nome duplicado', async () => {
    await prisma.product.create({ data: { name: 'Dup', priceCents: 100 } });
    await expect(
      prisma.product.create({ data: { name: 'Dup', priceCents: 200 } }),
    ).rejects.toThrow();
  });

  it('rejeita cliente com nome duplicado', async () => {
    await prisma.customer.create({ data: { name: 'Ana' } });
    await expect(prisma.customer.create({ data: { name: 'Ana' } })).rejects.toThrow();
  });

  it('rejeita item com quantidade zero', async () => {
    const product = await prisma.product.create({ data: { name: 'Item', priceCents: 100 } });
    const customer = await prisma.customer.create({ data: { name: 'Bia' } });
    await expect(
      prisma.order.create({
        data: {
          customerId: customer.id,
          totalCents: 0,
          items: { create: [{ productId: product.id, quantity: 0, priceCents: 100 }] },
        },
      }),
    ).rejects.toThrow();
  });
});
