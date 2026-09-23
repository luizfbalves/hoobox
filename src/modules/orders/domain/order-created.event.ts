import type { DomainEvent } from '../../../core/outbox/domain-event.js';
import { ORDER_CREATED_JOB } from '../../../core/queue/queue.constants.js';

export const ORDER_CREATED_EVENT = ORDER_CREATED_JOB;

export type OrderCreatedPayload = { orderId: number; correlationId: string };

export class OrderCreatedEvent implements DomainEvent {
  readonly type = ORDER_CREATED_EVENT;

  constructor(
    readonly orderId: number,
    readonly correlationId: string,
  ) {}

  get aggregateId(): number {
    return this.orderId;
  }

  toPayload(): OrderCreatedPayload {
    return { orderId: this.orderId, correlationId: this.correlationId };
  }
}
