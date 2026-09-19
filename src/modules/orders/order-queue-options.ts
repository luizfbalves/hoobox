import type { JobsOptions } from 'bullmq';

function resolveQueueBackoffDelayMs(): number {
  const fromEnv = process.env.ORDER_QUEUE_BACKOFF_MS;
  if (fromEnv !== undefined && fromEnv !== '') {
    const parsed = Number(fromEnv);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 1000;
}

export function buildOrderCreatedJobOptions(orderId: number): JobsOptions {
  return {
    jobId: `order-created-${orderId}`,
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: resolveQueueBackoffDelayMs() },
  };
}
