import { OrderStatus } from '../../../generated/prisma/enums.js';
import { ProcessOrderUseCase } from '../application/process-order.use-case.js';
import { ForcedProcessingError } from '../domain/orders.errors.js';
import { makeFakeOrdersRepository } from './fake-orders-repository.js';

const ctx = { correlationId: 'corr-1', jobId: 'outbox-1', attempt: 1 };

describe('ProcessOrderUseCase', () => {
  it('reserva estoque e confirma pedido PENDING', async () => {
    const repository = makeFakeOrdersRepository();
    const useCase = new ProcessOrderUseCase(repository);

    await expect(useCase.execute(1, ctx)).resolves.toBe('PROCESSED');
    expect(repository.reserveStockAndConfirm).toHaveBeenCalledWith(1);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('ignora pedido que não está PENDING (reentrega da mensagem)', async () => {
    const repository = makeFakeOrdersRepository({
      findForProcessing: vi
        .fn()
        .mockResolvedValue({ id: 1, status: OrderStatus.PROCESSED, customerName: 'Ana' }),
    });
    const useCase = new ProcessOrderUseCase(repository);

    await expect(useCase.execute(1, ctx)).resolves.toBe('SKIPPED');
    expect(repository.reserveStockAndConfirm).not.toHaveBeenCalled();
  });

  it('ignora pedido inexistente', async () => {
    const repository = makeFakeOrdersRepository({
      findForProcessing: vi.fn().mockResolvedValue(null),
    });
    const useCase = new ProcessOrderUseCase(repository);

    await expect(useCase.execute(1, ctx)).resolves.toBe('SKIPPED');
  });

  it('lança ForcedProcessingError para cliente com "fail" (fila retenta)', async () => {
    const repository = makeFakeOrdersRepository({
      findForProcessing: vi
        .fn()
        .mockResolvedValue({ id: 1, status: OrderStatus.PENDING, customerName: 'x fail y' }),
    });
    const useCase = new ProcessOrderUseCase(repository);

    await expect(useCase.execute(1, ctx)).rejects.toBeInstanceOf(ForcedProcessingError);
    expect(repository.reserveStockAndConfirm).not.toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('estoque insuficiente marca FAILED com motivo e não lança (sem retry)', async () => {
    const repository = makeFakeOrdersRepository({
      reserveStockAndConfirm: vi.fn().mockResolvedValue('INSUFFICIENT_STOCK'),
    });
    const useCase = new ProcessOrderUseCase(repository);

    await expect(useCase.execute(1, ctx)).resolves.toBe('FAILED');
    expect(repository.markFailed).toHaveBeenCalledWith(1, 'estoque insuficiente');
  });

  it('corrida: pedido deixou de ser PENDING entre leitura e lock', async () => {
    const repository = makeFakeOrdersRepository({
      reserveStockAndConfirm: vi.fn().mockResolvedValue('NOT_PENDING'),
    });
    const useCase = new ProcessOrderUseCase(repository);

    await expect(useCase.execute(1, ctx)).resolves.toBe('SKIPPED');
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('fail marca o pedido como FAILED com o motivo', async () => {
    const repository = makeFakeOrdersRepository();
    const useCase = new ProcessOrderUseCase(repository);

    await useCase.fail(1, 'falha simulada no processamento', ctx);
    expect(repository.markFailed).toHaveBeenCalledWith(1, 'falha simulada no processamento');
  });
});
