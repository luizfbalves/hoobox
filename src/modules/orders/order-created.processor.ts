import { Inject } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  ORDER_CREATED_JOB,
  ORDERS_QUEUE,
} from "../../core/queue/queue.constants.js";
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from "./orders.repository.js";

type OrderCreatedPayload = { orderId: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    await sleep(1000 + Math.random() * 1000);

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

    const reason =
      error?.message ??
      job.failedReason ??
      "erro no processamento";

    await this.ordersRepository.markFailed(orderId, reason);
  }
}
