import { Inject } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  ORDER_CREATED_JOB,
  ORDERS_QUEUE,
} from "../../../core/queue/queue.constants.js";
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from "../domain/orders.repository.js";
import { resolveProcessingDelayMs, sleep } from "./processing-delay.js";
import type { OrderCreatedPayload } from "../domain/order-created.event.js";

export function resolveFailureReason(
  error: Error | undefined,
  job: Job<OrderCreatedPayload>,
): string {
  const message = error?.message?.trim();
  if (message) {
    return message;
  }
  if (job.failedReason?.trim()) {
    return job.failedReason.trim();
  }
  return "erro no processamento";
}

@Processor(ORDERS_QUEUE)
export class OrderCreatedProcessor extends WorkerHost {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
  ) {
    super();
  }

  async process(job: Job<OrderCreatedPayload>): Promise<void> {
    if (job.name !== ORDER_CREATED_JOB) {
      return;
    }

    const { orderId } = job.data;

    await sleep(resolveProcessingDelayMs());

    await this.ordersRepository.processCreatedOrder(orderId);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<OrderCreatedPayload>, error: Error) {
    if (job.name !== ORDER_CREATED_JOB) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const orderId = job.data?.orderId;
    if (orderId == null) {
      return;
    }

    await this.ordersRepository.markFailed(
      orderId,
      resolveFailureReason(error, job),
    );
  }
}
