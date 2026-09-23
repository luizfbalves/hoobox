import { Module } from "@nestjs/common";
import { LoggingModule } from "./core/logging/logging.module.js";
import { PrismaModule } from "./core/prisma/prisma.module.js";
import { QueueModule } from "./core/queue/queue.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";

@Module({
  imports: [LoggingModule, PrismaModule, QueueModule, AuthModule, HealthModule, OrdersModule],
})
export class AppModule {}
