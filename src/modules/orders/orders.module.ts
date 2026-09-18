import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { ORDERS_REPOSITORY } from "./orders.repository.js";
import { PrismaOrdersRepository } from "./prisma-orders.repository.js";
import { BullModule } from "@nestjs/bullmq";
import { ORDERS_QUEUE } from "../../core/queue/queue.constants.js";
import { OrderCreatedProcessor } from "./order-created.processor.js";

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