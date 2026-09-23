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

  it('falha ao publicar mantém o evento pendente, registra o erro e segue o lote', async () => {
    const { store, published, failed } = makeStore([event(1), event(2)]);
    const add = vi
      .fn()
      .mockRejectedValueOnce(new Error('redis indisponível'))
      .mockResolvedValueOnce(undefined);
    const relay = new OutboxRelay(store, { add } as unknown as Queue);

    await expect(relay.tick()).resolves.toBe(1);

    expect(failed).toEqual([{ id: 1n, error: 'redis indisponível' }]);
    expect(published).toEqual([2n]);
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
});
