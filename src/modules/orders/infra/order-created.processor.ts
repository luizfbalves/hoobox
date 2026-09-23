import { Inject, Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  ORDER_CREATED_JOB,
  ORDERS_QUEUE,
} from "../../../core/queue/queue.constants.js";
import { readNonNegativeNumberEnv } from "../../../core/utils/env.js";
import {
  ProcessOrderUseCase,
  type ProcessingContext,
} from "../application/process-order.use-case.js";
import type { OrderCreatedPayload } from "../domain/order-created.event.js";
import { resolveProcessingDelayMs, sleep } from "./processing-delay.js";

// Tipo estrutural (não a classe) na assinatura do construtor: evita o helper
// ternário que o TS emite para emitDecoratorMetadata em parâmetros tipados por
// classe concreta, o que deixaria um branch de cobertura inatingível em testes.
type OrderProcessor = Pick<ProcessOrderUseCase, "execute" | "fail">;

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

function contextOf(job: Job<OrderCreatedPayload>, attempt: number): ProcessingContext {
  return { correlationId: job.data?.correlationId, jobId: job.id, attempt };
}

export function resolveWorkerConcurrency(): number {
  return Math.max(1, Math.trunc(readNonNegativeNumberEnv("ORDER_WORKER_CONCURRENCY", 1)));
}

@Processor(ORDERS_QUEUE, { concurrency: resolveWorkerConcurrency() })
export class OrderCreatedProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderCreatedProcessor.name);

  constructor(
    @Inject(ProcessOrderUseCase)
    private readonly processOrder: OrderProcessor,
  ) {
    super();
  }

  async process(job: Job<OrderCreatedPayload>): Promise<void> {
    if (job.name !== ORDER_CREATED_JOB) {
      return;
    }

    const ctx = contextOf(job, job.attemptsMade + 1);
    this.logger.log({ msg: "order.processing_started", orderId: job.data.orderId, ...ctx });

    await sleep(resolveProcessingDelayMs());
    await this.processOrder.execute(job.data.orderId, ctx);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<OrderCreatedPayload>, error: Error) {
    if (job.name !== ORDER_CREATED_JOB) {
      return;
    }

    const orderId = job.data?.orderId;
    if (orderId == null) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const ctx = contextOf(job, job.attemptsMade);
    const reason = resolveFailureReason(error, job);

    this.logger.warn({
      msg: "order.processing_failed",
      orderId,
      maxAttempts,
      error: reason,
      ...ctx,
    });

    if (job.attemptsMade < maxAttempts) {
      return;
    }

    await this.processOrder.fail(orderId, reason, ctx);
  }
}
