import { Job } from 'bullmq';
import { ORDER_CREATED_JOB } from '../../../core/queue/queue.constants.js';
import type { ProcessOrderUseCase } from '../application/process-order.use-case.js';
import type { OrderCreatedPayload } from '../domain/order-created.event.js';
import {
  OrderCreatedProcessor,
  resolveWorkerConcurrency,
} from '../infra/order-created.processor.js';

type OrderCreatedJob = Job<OrderCreatedPayload>;

function makeJob(partial: {
  name: string;
  data?: Partial<OrderCreatedPayload>;
  opts?: OrderCreatedJob['opts'];
  attemptsMade?: number;
  failedReason?: string;
}): OrderCreatedJob {
  return {
    id: 'outbox-1',
    name: partial.name,
    data: (partial.data ?? {}) as OrderCreatedPayload,
    opts: partial.opts ?? { attempts: 3 },
    attemptsMade: partial.attemptsMade ?? 0,
    failedReason: partial.failedReason,
  } as OrderCreatedJob;
}

describe('OrderCreatedProcessor', () => {
  let execute: ReturnType<typeof vi.fn>;
  let fail: ReturnType<typeof vi.fn>;
  let processor: OrderCreatedProcessor;

  beforeEach(() => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';
    execute = vi.fn().mockResolvedValue('PROCESSED');
    fail = vi.fn().mockResolvedValue(undefined);
    processor = new OrderCreatedProcessor({ execute, fail } as unknown as ProcessOrderUseCase);
  });

  afterEach(() => {
    delete process.env.ORDER_PROCESSING_DELAY_MS;
    delete process.env.ORDER_WORKER_CONCURRENCY;
  });

  describe('process', () => {
    it('retorna cedo para job com nome errado', async () => {
      await processor.process(makeJob({ name: 'other', data: { orderId: 1 } }));
      expect(execute).not.toHaveBeenCalled();
    });

    it('delega ao use case com contexto de correlação e tentativa', async () => {
      await processor.process(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 9, correlationId: 'corr-9' },
          attemptsMade: 1,
        }),
      );
      expect(execute).toHaveBeenCalledWith(9, {
        correlationId: 'corr-9',
        jobId: 'outbox-1',
        attempt: 2,
      });
    });
  });

  describe('onFailed', () => {
    it('ignora job com nome diferente', async () => {
      await processor.onFailed(makeJob({ name: 'other', data: { orderId: 1 } }), new Error('x'));
      expect(fail).not.toHaveBeenCalled();
    });

    it('não marca falha enquanto ainda há retries', async () => {
      await processor.onFailed(
        makeJob({ name: ORDER_CREATED_JOB, data: { orderId: 1 }, attemptsMade: 1 }),
        new Error('x'),
      );
      expect(fail).not.toHaveBeenCalled();
    });

    it('marca falha com a mensagem do erro após a última tentativa', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 5, correlationId: 'corr-5' },
          attemptsMade: 3,
        }),
        new Error('falha simulada no processamento'),
      );
      expect(fail).toHaveBeenCalledWith(5, 'falha simulada no processamento', {
        correlationId: 'corr-5',
        jobId: 'outbox-1',
        attempt: 3,
      });
    });

    it('usa failedReason quando o erro não tem mensagem', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 2 },
          attemptsMade: 3,
          failedReason: 'motivo do job',
        }),
        new Error(),
      );
      expect(fail).toHaveBeenCalledWith(2, 'motivo do job', expect.any(Object));
    });

    it('usa fallback quando não há mensagem nem failedReason', async () => {
      await processor.onFailed(
        makeJob({ name: ORDER_CREATED_JOB, data: { orderId: 2 }, attemptsMade: 3 }),
        new Error(),
      );
      expect(fail).toHaveBeenCalledWith(2, 'erro no processamento', expect.any(Object));
    });

    it('usa attempts padrão 1 quando opts.attempts ausente', async () => {
      await processor.onFailed(
        makeJob({ name: ORDER_CREATED_JOB, data: { orderId: 8 }, attemptsMade: 1, opts: {} }),
        new Error('definitivo'),
      );
      expect(fail).toHaveBeenCalledWith(8, 'definitivo', expect.any(Object));
    });

    it('ignora quando orderId ausente', async () => {
      await processor.onFailed(
        makeJob({ name: ORDER_CREATED_JOB, data: {}, attemptsMade: 3 }),
        new Error('x'),
      );
      expect(fail).not.toHaveBeenCalled();
    });
  });

  describe('resolveWorkerConcurrency', () => {
    it('padrão 1 e nunca menor que 1', () => {
      expect(resolveWorkerConcurrency()).toBe(1);
      process.env.ORDER_WORKER_CONCURRENCY = '0';
      expect(resolveWorkerConcurrency()).toBe(1);
    });

    it('usa ORDER_WORKER_CONCURRENCY truncada', () => {
      process.env.ORDER_WORKER_CONCURRENCY = '4.7';
      expect(resolveWorkerConcurrency()).toBe(4);
    });
  });
});
