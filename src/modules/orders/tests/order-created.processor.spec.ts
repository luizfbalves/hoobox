import { Job } from 'bullmq';
import { ORDER_CREATED_JOB } from '../../../core/queue/queue.constants.js';
import type { OrdersRepository } from '../domain/orders.repository.js';
import { OrderCreatedProcessor } from '../infra/order-created.processor.js';

type OrderCreatedJob = Job<{ orderId: number }>;

function makeJob(partial: {
  name: string;
  data?: { orderId?: number };
  opts?: OrderCreatedJob['opts'];
  attemptsMade?: number;
  failedReason?: string;
}): OrderCreatedJob {
  return {
    name: partial.name,
    data: (partial.data ?? {}) as { orderId: number },
    opts: partial.opts ?? { attempts: 3 },
    attemptsMade: partial.attemptsMade ?? 0,
    failedReason: partial.failedReason,
  } as OrderCreatedJob;
}

describe('OrderCreatedProcessor', () => {
  let repository: OrdersRepository;
  let processor: OrderCreatedProcessor;
  let markFailed: OrdersRepository['markFailed'];
  let processCreatedOrder: OrdersRepository['processCreatedOrder'];

  beforeEach(() => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';

    markFailed = vi
      .fn<OrdersRepository['markFailed']>()
      .mockResolvedValue(undefined);
    processCreatedOrder = vi
      .fn<OrdersRepository['processCreatedOrder']>()
      .mockResolvedValue(undefined);
    repository = {
      createWithItems: vi.fn(),
      findById: vi.fn(),
      findMany: vi.fn(),
      markFailed,
      processCreatedOrder,
    } satisfies OrdersRepository;
    processor = new OrderCreatedProcessor(repository);
  });

  afterEach(() => {
    delete process.env.ORDER_PROCESSING_DELAY_MS;
  });

  describe('onFailed', () => {
    it('ignora job com nome diferente', async () => {
      await processor.onFailed(
        makeJob({ name: 'other', data: { orderId: 1 } }),
        new Error('x'),
      );
      expect(markFailed).not.toHaveBeenCalled();
    });

    it('não marca falha enquanto ainda há retries', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 1 },
          attemptsMade: 1,
          opts: { attempts: 3 },
        }),
        new Error('x'),
      );
      expect(markFailed).not.toHaveBeenCalled();
    });

    it('marca falha com mensagem do error', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 5 },
          attemptsMade: 3,
          opts: { attempts: 3 },
        }),
        new Error('falha simulada no processamento'),
      );
      expect(markFailed).toHaveBeenCalledWith(
        5,
        'falha simulada no processamento',
      );
    });

    it('usa failedReason quando error não tem message', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 2 },
          attemptsMade: 3,
          opts: { attempts: 3 },
          failedReason: 'motivo do job',
        }),
        new Error(),
      );
      expect(markFailed).toHaveBeenCalledWith(2, 'motivo do job');
    });

    it('usa fallback quando não há message nem failedReason', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 2 },
          attemptsMade: 3,
          opts: { attempts: 3 },
        }),
        new Error(),
      );
      expect(markFailed).toHaveBeenCalledWith(
        2,
        'erro no processamento',
      );
    });

    it('usa attempts padrão 1 quando opts.attempts ausente', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: 8 },
          attemptsMade: 1,
          opts: {},
        }),
        new Error('definitivo'),
      );
      expect(markFailed).toHaveBeenCalledWith(8, 'definitivo');
    });

    it('ignora quando orderId ausente', async () => {
      await processor.onFailed(
        makeJob({
          name: ORDER_CREATED_JOB,
          data: { orderId: undefined },
          attemptsMade: 3,
          opts: { attempts: 3 },
        }),
        new Error('x'),
      );
      expect(markFailed).not.toHaveBeenCalled();
    });
  });

  describe('process', () => {
    it('retorna cedo para job com nome errado', async () => {
      await processor.process(
        makeJob({ name: 'other', data: { orderId: 1 } }),
      );
      expect(processCreatedOrder).not.toHaveBeenCalled();
    });

    it('processa pedido quando job é order.created', async () => {
      await processor.process(
        makeJob({ name: ORDER_CREATED_JOB, data: { orderId: 9 } }),
      );
      expect(processCreatedOrder).toHaveBeenCalledWith(9);
    });
  });
});
