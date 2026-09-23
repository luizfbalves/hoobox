import type { OrdersRepository } from '../domain/orders.repository.js';

export function makeFakeOrdersRepository(
  overrides: Partial<OrdersRepository> = {},
): OrdersRepository {
  return {
    createPending: vi.fn(),
    processCreatedOrder: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findMany: vi.fn(),
    markFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
