import { buildOrderCreatedJobOptions } from '../infra/order-queue-options.js';

describe('buildOrderCreatedJobOptions', () => {
  afterEach(() => {
    delete process.env.ORDER_QUEUE_BACKOFF_MS;
  });

  it('usa backoff padrão 1000 ms', () => {
    expect(buildOrderCreatedJobOptions(42)).toEqual({
      jobId: 'order-created-42',
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });

  it('ignora env inválida e usa backoff padrão', () => {
    process.env.ORDER_QUEUE_BACKOFF_MS = '-1';
    expect(buildOrderCreatedJobOptions(1).backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });
  });

  it('usa ORDER_QUEUE_BACKOFF_MS quando definida', () => {
    process.env.ORDER_QUEUE_BACKOFF_MS = '50';
    expect(buildOrderCreatedJobOptions(7).backoff).toEqual({
      type: 'exponential',
      delay: 50,
    });
  });
});
