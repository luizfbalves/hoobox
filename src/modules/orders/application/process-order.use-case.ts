import { Inject, Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '../../../generated/prisma/enums.js';
import { shouldSimulateFailure } from '../domain/forced-failure.js';
import {
  ForcedProcessingError,
  INSUFFICIENT_STOCK_REASON,
} from '../domain/orders.errors.js';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from '../domain/orders.repository.js';

export type ProcessingContext = {
  correlationId?: string;
  jobId?: string;
  attempt: number;
};

export type ProcessOrderOutcome = 'PROCESSED' | 'FAILED' | 'SKIPPED';

@Injectable()
export class ProcessOrderUseCase {
  private readonly logger = new Logger(ProcessOrderUseCase.name);

  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly orders: OrdersRepository,
  ) {}

  async execute(orderId: number, ctx: ProcessingContext): Promise<ProcessOrderOutcome> {
    const order = await this.orders.findForProcessing(orderId);
    if (!order || order.status !== OrderStatus.PENDING) {
      this.logger.log({ msg: 'order.processing_skipped', orderId, status: order?.status, ...ctx });
      return 'SKIPPED';
    }

    if (shouldSimulateFailure(order.customerName)) {
      throw new ForcedProcessingError();
    }

    const result = await this.orders.reserveStockAndConfirm(orderId);

    if (result === 'PROCESSED') {
      this.logger.log({ msg: 'order.processed', orderId, ...ctx });
      return 'PROCESSED';
    }

    if (result === 'INSUFFICIENT_STOCK') {
      await this.orders.markFailed(orderId, INSUFFICIENT_STOCK_REASON);
      this.logger.warn({ msg: 'order.stock_insufficient', orderId, ...ctx });
      return 'FAILED';
    }

    this.logger.log({ msg: 'order.processing_skipped', orderId, reason: 'not_pending_on_lock', ...ctx });
    return 'SKIPPED';
  }

  async fail(orderId: number, reason: string, ctx: ProcessingContext): Promise<void> {
    await this.orders.markFailed(orderId, reason);
    this.logger.error({ msg: 'order.failed', orderId, reason, ...ctx });
  }
}
