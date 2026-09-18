import 'dotenv/config';
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
      const existing = await prisma.product.findFirst({
        where: { name: product.name },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            priceCents: product.priceCents,
            stock: INITIAL_STOCK,
          },
        });
      } else {
        await prisma.product.create({
          data: {
            name: product.name,
            priceCents: product.priceCents,
            stock: INITIAL_STOCK,
          },
        });
      }
    }

    console.log(`Seed: ${products.length} produtos garantidos (estoque ${INITIAL_STOCK}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
