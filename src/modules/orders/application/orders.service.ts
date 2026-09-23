import { Inject, Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CreateOrderDto } from "../http/dtos/create-order.dto.js";
import { ListOrdersQueryDto } from "../http/dtos/list-orders-query.dto.js";
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from "../domain/orders.repository.js";
import {
  ORDER_CREATED_JOB,
  ORDERS_QUEUE,
} from "../../../core/queue/queue.constants.js";
import { buildOrderCreatedJobOptions } from "../infra/order-queue-options.js";

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    @InjectQueue(ORDERS_QUEUE)
    private readonly ordersQueue: Queue,
  ) {}

  public async createOrder(props: CreateOrderDto) {
    const order = await this.ordersRepository.createWithItems(props);
    await this.ordersQueue.add(
      ORDER_CREATED_JOB,
      { orderId: order.id },
      buildOrderCreatedJobOptions(order.id),
    );

    return { status: "ok" };
  }

  public getOrderById(id: number) {
    return this.ordersRepository.findById(id);
  }

  public listOrders(query: ListOrdersQueryDto) {
    return this.ordersRepository.findMany(query.page, query.limit);
  }
}
