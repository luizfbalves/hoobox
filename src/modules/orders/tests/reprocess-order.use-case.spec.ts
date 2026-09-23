import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReprocessOrderUseCase } from '../application/reprocess-order.use-case.js';
import { OrderCreatedEvent } from '../domain/order-created.event.js';
import type { BuildEvents } from '../domain/orders.repository.js';
import { makeFakeOrdersRepository } from './fake-orders-repository.js';

describe('ReprocessOrderUseCase', () => {
  it('reenfileira pedido FAILED com novo OrderCreatedEvent', async () => {
    const requeueFailed = vi.fn(
      async (_id: number, _correlationId: string, _build: BuildEvents) => 'REQUEUED' as const,
    );
    const useCase = new ReprocessOrderUseCase(makeFakeOrdersRepository({ requeueFailed }));

    await expect(useCase.execute(7, 'corr-r')).resolves.toEqual({
      id: 7,
      status: 'PENDING',
      correlationId: 'corr-r',
    });

    expect(requeueFailed.mock.calls[0]![1]).toBe('corr-r');
    const events = requeueFailed.mock.calls[0]![2](7);
    expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    expect(events[0]!.toPayload()).toEqual({ orderId: 7, correlationId: 'corr-r' });
  });

  it('404 quando o pedido não existe', async () => {
    const useCase = new ReprocessOrderUseCase(
      makeFakeOrdersRepository({ requeueFailed: vi.fn().mockResolvedValue('NOT_FOUND') }),
    );
    await expect(useCase.execute(7, 'c')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 quando o pedido não está FAILED', async () => {
    const useCase = new ReprocessOrderUseCase(
      makeFakeOrdersRepository({ requeueFailed: vi.fn().mockResolvedValue('NOT_FAILED') }),
    );
    await expect(useCase.execute(7, 'c')).rejects.toBeInstanceOf(ConflictException);
  });
});
