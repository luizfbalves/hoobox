import type { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type {
  OutboxStore,
  PendingOutboxEvent,
} from '../../../core/outbox/outbox.store.js';
import { OutboxRelay } from '../infra/outbox-relay.js';

function event(id: number): PendingOutboxEvent {
  return {
    id: BigInt(id),
    eventType: 'order.created',
    payload: { orderId: id, correlationId: `corr-${id}` },
    attempts: 0,
  };
}

function makeStore(events: PendingOutboxEvent[]) {
  const published: bigint[] = [];
  const failed: Array<{ id: bigint; error: string }> = [];
  const store: OutboxStore = {
    withPendingBatch: vi.fn(async (_limit: number, handler) =>
      handler({
        events,
        markPublished: async (id: bigint) => {
          published.push(id);
        },
        markFailed: async (id: bigint, error: string) => {
          failed.push({ id, error });
        },
      }),
    ),
  };
  return { store, published, failed };
}

describe('OutboxRelay.tick', () => {
  it('publica cada evento na fila com jobId do outbox e marca como publicado', async () => {
    const { store, published } = makeStore([event(1), event(2)]);
    const add = vi.fn().mockResolvedValue(undefined);
    const relay = new OutboxRelay(store, { add } as unknown as Queue);

    await expect(relay.tick()).resolves.toBe(2);

    expect(add).toHaveBeenCalledWith(
      'order.created',
      { orderId: 1, correlationId: 'corr-1' },
      expect.objectContaining({ jobId: 'outbox-1', attempts: 3 }),
    );
    expect(published).toEqual([1n, 2n]);
  });

  it('falha ao publicar registra o erro e interrompe o lote, deixando os seguintes pendentes', async () => {
    const { store, published, failed } = makeStore([event(1), event(2)]);
    const add = vi.fn().mockRejectedValueOnce(new Error('redis indisponível'));
    const relay = new OutboxRelay(store, { add } as unknown as Queue);

    await expect(relay.tick()).resolves.toBe(0);

    expect(failed).toEqual([{ id: 1n, error: 'redis indisponível' }]);
    expect(add).toHaveBeenCalledTimes(1);
    expect(published).toEqual([]);
  });

  it('markFailed que lança não derruba o tick e nada depois dele é tentado', async () => {
    const markFailed = vi.fn().mockRejectedValue(new Error('Transaction already closed'));
    const markPublished = vi.fn();
    const store: OutboxStore = {
      withPendingBatch: vi.fn(async (_limit: number, handler) =>
        handler({ events: [event(1), event(2)], markPublished, markFailed }),
      ),
    };
    const add = vi.fn().mockRejectedValue(new Error('redis indisponível'));
    const relay = new OutboxRelay(store, { add } as unknown as Queue);
    const logError = vi
      .spyOn((relay as unknown as { logger: Logger }).logger, 'error')
      .mockImplementation(() => {});

    await expect(relay.tick()).resolves.toBe(0);

    expect(logError).toHaveBeenCalledWith({
      msg: 'outbox.mark_failed_error',
      outboxId: '1',
      error: 'Transaction already closed',
    });
    expect(logError).not.toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'outbox.tick_failed' }),
    );
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
    expect(markPublished).not.toHaveBeenCalled();
  });

  it('não sobrepõe execuções', async () => {
    let release!: () => void;
    const store: OutboxStore = {
      withPendingBatch: vi.fn(
        () => new Promise<never>((resolve) => {
          release = () => resolve(0 as never);
        }),
      ),
    };
    const relay = new OutboxRelay(store, { add: vi.fn() } as unknown as Queue);

    const first = relay.tick();
    await expect(relay.tick()).resolves.toBe(0);
    expect(store.withPendingBatch).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it('erro no store não derruba o relay', async () => {
    const store: OutboxStore = {
      withPendingBatch: vi.fn().mockRejectedValue(new Error('db fora')),
    };
    const relay = new OutboxRelay(store, { add: vi.fn() } as unknown as Queue);

    await expect(relay.tick()).resolves.toBe(0);
  });

  it('publish que nunca resolve estoura timeout, marca falha e interrompe o lote', async () => {
    process.env.OUTBOX_PUBLISH_TIMEOUT_MS = '20';
    try {
      const { store, published, failed } = makeStore([event(1), event(2)]);
      const add = vi.fn().mockImplementationOnce(() => new Promise(() => {}));
      const relay = new OutboxRelay(store, { add } as unknown as Queue);

      await expect(relay.tick()).resolves.toBe(0);

      expect(failed).toEqual([{ id: 1n, error: 'publish timeout after 20ms' }]);
      expect(add).toHaveBeenCalledTimes(1);
      expect(published).toEqual([]);
    } finally {
      delete process.env.OUTBOX_PUBLISH_TIMEOUT_MS;
    }
  });
});
