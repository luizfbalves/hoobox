import { Module } from "@nestjs/common";
import { PrismaModule } from "./core/prisma/prisma.module.js";
import { QueueModule } from "./core/queue/queue.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";

@Module({
  imports: [PrismaModule, QueueModule, HealthModule, OrdersModule],
})
export class AppModule {}
