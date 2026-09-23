import { OrderStatus } from '../../../generated/prisma/enums.js';
import type { OrdersRepository } from '../domain/orders.repository.js';

export function makeFakeOrdersRepository(
  overrides: Partial<OrdersRepository> = {},
): OrdersRepository {
  return {
    createPending: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    findForProcessing: vi
      .fn()
      .mockResolvedValue({ id: 1, status: OrderStatus.PENDING, customerName: 'Ana' }),
    reserveStockAndConfirm: vi.fn().mockResolvedValue('PROCESSED'),
    markFailed: vi.fn().mockResolvedValue(undefined),
    requeueFailed: vi.fn().mockResolvedValue('REQUEUED'),
    ...overrides,
  };
}
