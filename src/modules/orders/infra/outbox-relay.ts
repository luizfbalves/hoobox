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

// Publica eventos do outbox no BullMQ (at-least-once). O jobId deduplica enquanto o job
// ainda está no Redis; depois de concluído (removeOnComplete), duplicatas são absorvidas
// pela guarda PENDING/lock do worker.
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
    const intervalMs = readNonNegativeNumberEnv('OUTBOX_POLL_MS', 500);
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  // Espera o tick em andamento para não fechar Prisma/fila no meio de um lote.
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

  // Primeira falha interrompe o lote: com o Redis fora, cada publicação pode levar até
  // OUTBOX_PUBLISH_TIMEOUT_MS e seguir adiante estouraria o timeout da transação,
  // desfazendo os attempts já registrados. Os demais eventos ficam para o próximo tick.
  private async runBatch(): Promise<number> {
    try {
      return await this.store.withPendingBatch(OUTBOX_BATCH_SIZE, async (batch) => {
        let published = 0;
        for (const event of batch.events) {
          const correlationId = (event.payload as { correlationId?: string })?.correlationId;
          try {
            await withTimeout(
              this.queue.add(
                event.eventType,
                event.payload,
                buildOrderCreatedJobOptions(event.id),
              ),
              readNonNegativeNumberEnv('OUTBOX_PUBLISH_TIMEOUT_MS', 5000),
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
            this.logger.warn({
              msg: 'outbox.publish_failed',
              outboxId: String(event.id),
              attempts: event.attempts + 1,
              correlationId,
              error: message,
            });
            try {
              await batch.markFailed(event.id, message);
            } catch (markError) {
              this.logger.error({
                msg: 'outbox.mark_failed_error',
                outboxId: String(event.id),
                error: markError instanceof Error ? markError.message : String(markError),
              });
            }
            break;
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
