import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../src/generated/prisma/client.js';

export function getTestPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({
    adapter: new PrismaMariaDb(connectionString),
  });
}

export async function resetOrdersData(prisma: PrismaClient): Promise<void> {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
}

export async function seedMinimalProducts(
  prisma: PrismaClient,
  products: Array<{ name: string; priceCents: number; stock: number }>,
): Promise<void> {
  for (const product of products) {
    await prisma.product.create({ data: product });
  }
}
