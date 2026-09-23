import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { OUTBOX_STORE, type OutboxStore } from '../../../core/outbox/outbox.store.js';
import { ORDERS_QUEUE } from '../../../core/queue/queue.constants.js';
import { readNonNegativeNumberEnv } from '../../../core/utils/env.js';
import { buildOrderCreatedJobOptions } from './order-queue-options.js';

const OUTBOX_BATCH_SIZE = 50;

// Publica eventos do outbox no BullMQ (at-least-once). Duplicatas são absorvidas
// pelo jobId fixo e pela idempotência do worker.
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    @InjectQueue(ORDERS_QUEUE) private readonly queue: Queue,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = readNonNegativeNumberEnv('OUTBOX_POLL_MS', 500);
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    if (this.running) {
      return 0;
    }
    this.running = true;
    try {
      return await this.store.withPendingBatch(OUTBOX_BATCH_SIZE, async (batch) => {
        let published = 0;
        for (const event of batch.events) {
          const correlationId = (event.payload as { correlationId?: string })?.correlationId;
          try {
            await this.queue.add(
              event.eventType,
              event.payload,
              buildOrderCreatedJobOptions(event.id),
            );
            await batch.markPublished(event.id);
            published++;
            this.logger.log({
              msg: 'outbox.published',
              outboxId: String(event.id),
              eventType: event.eventType,
              correlationId,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await batch.markFailed(event.id, message);
            this.logger.warn({
              msg: 'outbox.publish_failed',
              outboxId: String(event.id),
              attempts: event.attempts + 1,
              correlationId,
              error: message,
            });
          }
        }
        return published;
      });
    } catch (error) {
      this.logger.error({
        msg: 'outbox.tick_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      this.running = false;
    }
  }
}
