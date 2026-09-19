import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ORDER_CREATED_JOB, ORDERS_QUEUE } from '../../../core/queue/queue.constants.js';
import { ORDERS_REPOSITORY } from '../orders.repository.js';
import { OrdersService } from '../orders.service.js';
import { buildOrderCreatedJobOptions } from '../order-queue-options.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: {
    createWithItems: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  let queue: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = {
      createWithItems: vi.fn().mockResolvedValue({ id: 42 }),
      findById: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue({ data: [] }),
    };
    queue = { add: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: ORDERS_REPOSITORY, useValue: repository },
        { provide: getQueueToken(ORDERS_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('createOrder enfileira job com opções padrão', async () => {
    const dto = {
      customerName: 'Maria',
      items: [{ productName: 'Camiseta', quantity: 1, price: 19.99 }],
    };

    await expect(service.createOrder(dto)).resolves.toEqual({ status: 'ok' });
    expect(repository.createWithItems).toHaveBeenCalledWith(dto);
    expect(queue.add).toHaveBeenCalledWith(
      ORDER_CREATED_JOB,
      { orderId: 42 },
      buildOrderCreatedJobOptions(42),
    );
  });

  it('getOrderById delega ao repositório', async () => {
    await service.getOrderById(7);
    expect(repository.findById).toHaveBeenCalledWith(7);
  });

  it('listOrders delega ao repositório', async () => {
    await service.listOrders({ page: 2, limit: 5 });
    expect(repository.findMany).toHaveBeenCalledWith(2, 5);
  });
});
