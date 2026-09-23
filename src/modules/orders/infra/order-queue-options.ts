import type { JobsOptions } from 'bullmq';
import { readNonNegativeNumberEnv } from '../../../core/utils/env.js';

// jobId fixo por evento do outbox: deduplica enquanto o job ainda está no Redis; depois de
// concluído (removeOnComplete), duplicatas são absorvidas pela guarda PENDING/lock do worker.
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
