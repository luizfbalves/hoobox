import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { OUTBOX_STORE } from "../../core/outbox/outbox.store.js";
import { PrismaOutboxStore } from "../../core/outbox/prisma-outbox.store.js";
import { ORDERS_QUEUE } from "../../core/queue/queue.constants.js";
import { CreateOrderUseCase } from "./application/create-order.use-case.js";
import { OrderQueries } from "./application/order-queries.js";
import { ORDERS_REPOSITORY } from "./domain/orders.repository.js";
import { OrdersController } from "./http/orders.controller.js";
import { OrderCreatedProcessor } from "./infra/order-created.processor.js";
import { OutboxRelay } from "./infra/outbox-relay.js";
import { PrismaOrdersRepository } from "./infra/prisma-orders.repository.js";

@Module({
  imports: [BullModule.registerQueue({ name: ORDERS_QUEUE })],
  controllers: [OrdersController],
  providers: [
    CreateOrderUseCase,
    OrderQueries,
    OrderCreatedProcessor,
    OutboxRelay,
    { provide: ORDERS_REPOSITORY, useClass: PrismaOrdersRepository },
    { provide: OUTBOX_STORE, useClass: PrismaOutboxStore },
  ],
})
export class OrdersModule {}
