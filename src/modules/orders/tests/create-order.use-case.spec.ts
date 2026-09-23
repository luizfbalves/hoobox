import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../../../generated/prisma/enums.js';
import { CreateOrderUseCase } from '../application/create-order.use-case.js';
import { OrderCreatedEvent } from '../domain/order-created.event.js';
import type { BuildEvents, NewOrderDraft } from '../domain/orders.repository.js';
import { makeFakeOrdersRepository } from './fake-orders-repository.js';

describe('CreateOrderUseCase', () => {
  it('calcula total em centavos, grava PENDING e registra OrderCreatedEvent', async () => {
    const createPending = vi.fn(async (_draft: NewOrderDraft, _build: BuildEvents) => ({
      id: 42,
      customerId: 1,
      totalCents: 5048,
      total: '50.48',
      status: OrderStatus.PENDING,
    }));
    const useCase = new CreateOrderUseCase(makeFakeOrdersRepository({ createPending }));

    const result = await useCase.execute(
      {
        customerName: 'Ana',
        items: [
          { productName: 'Camiseta', quantity: 2, price: 19.99 },
          { productName: 'Meia', quantity: 1, price: 10.5 },
        ],
      },
      'corr-1',
    );

    expect(result).toEqual({ id: 42, status: OrderStatus.PENDING, correlationId: 'corr-1' });

    const [draft, buildEvents] = createPending.mock.calls[0]!;
    expect(draft).toEqual({
      customerName: 'Ana',
      correlationId: 'corr-1',
      totalCents: 2 * 1999 + 1050,
      items: [
        { productName: 'Camiseta', quantity: 2, priceCents: 1999 },
        { productName: 'Meia', quantity: 1, priceCents: 1050 },
      ],
    });

    const events = buildEvents(42);
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    expect(events[0]!.toPayload()).toEqual({ orderId: 42, correlationId: 'corr-1' });
  });

  it('rejeita total acima do limite sem tocar no repositório', async () => {
    const createPending = vi.fn();
    const useCase = new CreateOrderUseCase(makeFakeOrdersRepository({ createPending }));

    await expect(
      useCase.execute(
        { customerName: 'Max', items: [{ productName: 'X', quantity: 2, price: 21_474_836 }] },
        'corr-2',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(createPending).not.toHaveBeenCalled();
  });
});
