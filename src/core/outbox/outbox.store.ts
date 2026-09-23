export const OUTBOX_STORE = Symbol('OUTBOX_STORE');

export type PendingOutboxEvent = {
  id: bigint;
  eventType: string;
  payload: unknown;
  attempts: number;
};

export interface OutboxBatch {
  events: PendingOutboxEvent[];
  markPublished(id: bigint): Promise<void>;
  markFailed(id: bigint, error: string): Promise<void>;
}

export interface OutboxStore {
  withPendingBatch<T>(
    limit: number,
    handler: (batch: OutboxBatch) => Promise<T>,
  ): Promise<T>;
}
