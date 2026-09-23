import bcrypt from 'bcryptjs';
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
  await prisma.outboxEvent.deleteMany();
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

export const TEST_USERS = {
  admin: { password: 'admin123', role: 'ADMIN' },
  user: { password: 'user123', role: 'USER' },
} as const;

export async function seedTestUsers(prisma: PrismaClient): Promise<void> {
  for (const [username, { password, role }] of Object.entries(TEST_USERS)) {
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, passwordHash: await bcrypt.hash(password, 4), role },
    });
  }
}

export async function createPendingOrder(
  prisma: PrismaClient,
  input: {
    customerName: string;
    items: Array<{ productId: number; quantity: number }>;
  },
): Promise<number> {
  const customer = await prisma.customer.upsert({
    where: { name: input.customerName },
    update: {},
    create: { name: input.customerName },
  });
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      totalCents: 0,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          priceCents: 100,
        })),
      },
    },
  });
  return order.id;
}
