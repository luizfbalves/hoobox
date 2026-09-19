import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

type OrderStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export async function waitForOrderStatus(
  app: INestApplication<App>,
  orderId: number,
  expected: OrderStatus,
  options?: { timeoutMs?: number; intervalMs?: number; failureReason?: string },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const intervalMs = options?.intervalMs ?? 100;
  const deadline = Date.now() + timeoutMs;

  let lastHttpStatus: number | undefined;
  let lastBodyStatus: unknown;
  let lastFailureReason: unknown;

  while (Date.now() < deadline) {
    const res = await request(app.getHttpServer()).get(`/orders/${orderId}`);
    lastHttpStatus = res.status;
    lastBodyStatus = res.body?.status;
    lastFailureReason = res.body?.failureReason;

    if (res.status === 200 && res.body.status === expected) {
      if (
        options?.failureReason !== undefined &&
        res.body.failureReason !== options.failureReason
      ) {
        await sleep(intervalMs);
        continue;
      }
      return;
    }
    await sleep(intervalMs);
  }

  const expectedReason =
    options?.failureReason !== undefined
      ? `, failureReason esperado="${options.failureReason}"`
      : '';
  throw new Error(
    `Pedido ${orderId} não atingiu status ${expected} em ${timeoutMs}ms` +
      `${expectedReason}. Último: HTTP ${lastHttpStatus ?? '?'}, ` +
      `status=${String(lastBodyStatus)}, failureReason=${String(lastFailureReason)}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
