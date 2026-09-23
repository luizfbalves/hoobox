import { Inject, Injectable, Logger } from '@nestjs/common';
import { toCents } from '../../../core/utils/money.js';
import type { OrderStatus } from '../../../generated/prisma/enums.js';
import { OrderCreatedEvent } from '../domain/order-created.event.js';
import {
  assertOrderTotalWithinLimit,
  calculateOrderTotalCents,
} from '../domain/order-total.js';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from '../domain/orders.repository.js';

export type CreateOrderInput = {
  customerName: string;
  items: Array<{ productName: string; quantity: number; price: number }>;
};

export type CreatedOrder = {
  id: number;
  status: OrderStatus;
  correlationId: string;
};

@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly orders: OrdersRepository,
  ) {}

  async execute(input: CreateOrderInput, correlationId: string): Promise<CreatedOrder> {
    const totalCents = calculateOrderTotalCents(input.items);
    assertOrderTotalWithinLimit(totalCents);

    const order = await this.orders.createPending(
      {
        customerName: input.customerName,
        correlationId,
        totalCents,
        items: input.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          priceCents: toCents(item.price),
        })),
      },
      (orderId) => [new OrderCreatedEvent(orderId, correlationId)],
    );

    this.logger.log({ msg: 'order.created', orderId: order.id, correlationId, totalCents });

    return { id: order.id, status: order.status, correlationId };
  }
}
