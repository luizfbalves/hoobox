import { Module } from "@nestjs/common";
import { OrdersController } from "./http/orders.controller.js";
import { OrdersService } from "./application/orders.service.js";
import { ORDERS_REPOSITORY } from "./domain/orders.repository.js";
import { PrismaOrdersRepository } from "./infra/prisma-orders.repository.js";
import { BullModule } from "@nestjs/bullmq";
import { ORDERS_QUEUE } from "../../core/queue/queue.constants.js";
import { OrderCreatedProcessor } from "./infra/order-created.processor.js";

@Module({
    imports: [BullModule.registerQueue({name: ORDERS_QUEUE})],
    controllers: [OrdersController],
    providers: [
        OrdersService,
        OrderCreatedProcessor,
        {
            provide: ORDERS_REPOSITORY,
            useClass: PrismaOrdersRepository,
        },
    ],
})
export class OrdersModule {}