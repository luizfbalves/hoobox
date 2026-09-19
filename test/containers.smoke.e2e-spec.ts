import { Redis } from 'ioredis';
import { getTestPrisma } from './helpers/test-db.js';

describe('Testcontainers smoke', () => {
  it('conecta ao MySQL e Redis', async () => {
    const prisma = getTestPrisma();
    try {
      const rows = await prisma.$queryRaw<{ ok: bigint }[]>`SELECT 1 AS ok`;
      expect(rows[0]?.ok).toBe(1n);
    } finally {
      await prisma.$disconnect();
    }

    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      maxRetriesPerRequest: null,
    });
    try {
      expect(await redis.ping()).toBe('PONG');
    } finally {
      await redis.quit();
    }
  });
});
