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
import { readPositiveNumberEnv } from '../../../core/utils/env.js';
import { buildOrderCreatedJobOptions } from './order-queue-options.js';

const OUTBOX_BATCH_SIZE = 50;

const OUTBOX_BATCH_BUDGET_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`publish timeout after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private inFlight?: Promise<number>;

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    @InjectQueue(ORDERS_QUEUE) private readonly queue: Queue,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = readPositiveNumberEnv('OUTBOX_POLL_MS', 500);
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.inFlight;
  }

  tick(): Promise<number> {
    if (this.running) {
      return Promise.resolve(0);
    }
    this.running = true;
    this.inFlight = this.runBatch();
    return this.inFlight;
  }

  private async runBatch(): Promise<number> {
    const publishTimeoutMs = readPositiveNumberEnv('OUTBOX_PUBLISH_TIMEOUT_MS', 5000);
    try {
      return await this.store.withPendingBatch(OUTBOX_BATCH_SIZE, async (batch) => {
        const deadline = Date.now() + OUTBOX_BATCH_BUDGET_MS;
        let published = 0;
        for (const event of batch.events) {
          if (Date.now() > deadline) {
            break;
          }
          const outboxId = String(event.id);
          const correlationId = (event.payload as { correlationId?: string })?.correlationId;
          try {
            await withTimeout(
              this.queue.add(
                event.eventType,
                event.payload,
                buildOrderCreatedJobOptions(event.id),
              ),
              publishTimeoutMs,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn({
              msg: 'outbox.publish_failed',
              outboxId,
              attempts: event.attempts + 1,
              correlationId,
              error: message,
            });
            try {
              await batch.markFailed(event.id, message);
            } catch (markError) {
              this.logger.error({
                msg: 'outbox.mark_failed_error',
                outboxId,
                error: markError instanceof Error ? markError.message : String(markError),
              });
            }
            break;
          }

          try {
            await batch.markPublished(event.id);
          } catch (markError) {
            this.logger.error({
              msg: 'outbox.mark_published_error',
              outboxId,
              correlationId,
              error: markError instanceof Error ? markError.message : String(markError),
            });
            break;
          }
          published++;
          this.logger.log({
            msg: 'outbox.published',
            outboxId,
            eventType: event.eventType,
            correlationId,
          });
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
