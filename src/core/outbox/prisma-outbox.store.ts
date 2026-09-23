import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  OutboxBatch,
  OutboxStore,
  PendingOutboxEvent,
} from './outbox.store.js';

type RawOutboxRow = {
  id: bigint | number | string;
  eventType: string;
  payload: unknown;
  attempts: number | bigint;
};

@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  withPendingBatch<T>(
    limit: number,
    handler: (batch: OutboxBatch) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<RawOutboxRow[]>`
          SELECT id, event_type AS eventType, payload, attempts
          FROM outbox_events
          WHERE published_at IS NULL
          ORDER BY id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        const events: PendingOutboxEvent[] = rows.map((row) => ({
          id: BigInt(row.id),
          eventType: row.eventType,
          payload:
            typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
          attempts: Number(row.attempts),
        }));

        return handler({
          events,
          markPublished: async (id) => {
            await tx.outboxEvent.update({
              where: { id },
              data: { publishedAt: new Date() },
            });
          },
          markFailed: async (id, error) => {
            await tx.outboxEvent.update({
              where: { id },
              data: { attempts: { increment: 1 }, lastError: error.slice(0, 255) },
            });
          },
        });
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
