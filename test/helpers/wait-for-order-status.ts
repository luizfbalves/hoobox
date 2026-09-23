import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { OrderStatus } from '../../src/generated/prisma/enums.js';
import { waitFor } from './wait-for.js';

export function waitForOrderStatus(
  prisma: PrismaClient,
  orderId: number,
  expected: OrderStatus,
  options: { timeoutMs?: number; failureReason?: string } = {},
) {
  return waitFor(
    async () => {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order?.status !== expected) {
        return null;
      }
      if (
        options.failureReason !== undefined &&
        order.failureReason !== options.failureReason
      ) {
        return null;
      }
      return order;
    },
    {
      timeoutMs: options.timeoutMs,
      description: `pedido ${orderId} em ${expected}`,
    },
  );
}

export function waitForOrderSettled(
  prisma: PrismaClient,
  orderId: number,
  timeoutMs?: number,
) {
  return waitFor(
    async () => {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      return order && order.status !== 'PENDING' ? order : null;
    },
    { timeoutMs, description: `pedido ${orderId} sair de PENDING` },
  );
}
