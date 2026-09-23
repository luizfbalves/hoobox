import type { JobsOptions } from 'bullmq';
import { readNonNegativeNumberEnv } from '../../../core/utils/env.js';

// jobId fixo por evento do outbox: republicar após crash do relay não duplica o job.
export function buildOrderCreatedJobOptions(outboxId: bigint): JobsOptions {
  return {
    jobId: `outbox-${outboxId}`,
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: readNonNegativeNumberEnv('ORDER_QUEUE_BACKOFF_MS', 1000),
    },
  };
}
