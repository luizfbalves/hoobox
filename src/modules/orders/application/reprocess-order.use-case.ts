import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderCreatedEvent } from '../domain/order-created.event.js';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from '../domain/orders.repository.js';

@Injectable()
export class ReprocessOrderUseCase {
  private readonly logger = new Logger(ReprocessOrderUseCase.name);

  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly orders: OrdersRepository,
  ) {}

  async execute(orderId: number, correlationId: string) {
    const result = await this.orders.requeueFailed(orderId, correlationId, (id) => [
      new OrderCreatedEvent(id, correlationId),
    ]);

    if (result === 'NOT_FOUND') {
      throw new NotFoundException(`Pedido ${orderId} não encontrado`);
    }
    if (result === 'NOT_FAILED') {
      throw new ConflictException(`Pedido ${orderId} não está FAILED`);
    }

    this.logger.log({ msg: 'order.reprocess_requested', orderId, correlationId });
    return { id: orderId, status: 'PENDING' as const, correlationId };
  }
}
