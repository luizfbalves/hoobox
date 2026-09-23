import { buildOrderCreatedJobOptions } from '../infra/order-queue-options.js';

describe('buildOrderCreatedJobOptions', () => {
  afterEach(() => {
    delete process.env.ORDER_QUEUE_BACKOFF_MS;
  });

  it('usa jobId derivado do id do outbox e backoff padrão 1000 ms', () => {
    expect(buildOrderCreatedJobOptions(7n)).toEqual({
      jobId: 'outbox-7',
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });

  it('ignora env inválida e usa backoff padrão', () => {
    process.env.ORDER_QUEUE_BACKOFF_MS = 'abc';
    expect(buildOrderCreatedJobOptions(1n).backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });
  });

  it('usa ORDER_QUEUE_BACKOFF_MS quando definida', () => {
    process.env.ORDER_QUEUE_BACKOFF_MS = '250';
    expect(buildOrderCreatedJobOptions(1n).backoff).toEqual({
      type: 'exponential',
      delay: 250,
    });
  });
});
