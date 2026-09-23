import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

const INITIAL_STOCK = 5;

const products = [
  { name: 'Camiseta', priceCents: 1999 },
  { name: 'Calça Jeans', priceCents: 8990 },
  { name: 'Tênis Esportivo', priceCents: 24990 },
  { name: 'Boné', priceCents: 4590 },
  { name: 'Moletom', priceCents: 12990 },
  { name: 'Meia Kit 3', priceCents: 2990 },
  { name: 'Jaqueta', priceCents: 18990 },
  { name: 'Shorts', priceCents: 5990 },
  { name: 'Mochila', priceCents: 15990 },
  { name: 'Relógio', priceCents: 34990 },
] as const;

const users = [
  { username: 'admin', password: 'admin123', role: 'ADMIN' },
  { username: 'user', password: 'user123', role: 'USER' },
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(connectionString),
  });

  try {
    for (const product of products) {
      await prisma.product.upsert({
        where: { name: product.name },
        update: {},
        create: { ...product, stock: INITIAL_STOCK },
      });
    }

    for (const user of users) {
      await prisma.user.upsert({
        where: { username: user.username },
        update: {},
        create: {
          username: user.username,
          passwordHash: await bcrypt.hash(user.password, 10),
          role: user.role,
        },
      });
    }

    console.log(
      `Seed: ${products.length} produtos e ${users.length} usuários garantidos.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
