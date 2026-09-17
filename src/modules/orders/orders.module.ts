import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { ORDERS_REPOSITORY } from "./orders.repository.js";
import { PrismaOrdersRepository } from "./prisma-orders.repository.js";

@Module({
    controllers: [OrdersController],
    providers: [
        OrdersService,
        {
            provide: ORDERS_REPOSITORY,
            useClass: PrismaOrdersRepository,
        },
    ],
})
export class OrdersModule {}