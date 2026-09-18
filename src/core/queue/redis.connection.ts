import { Redis } from 'ioredis';

export function createRedisConnection(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });
}
