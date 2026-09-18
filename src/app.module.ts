import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { PrismaModule } from "./core/prisma/prisma.module.js";
import { QueueModule } from "./core/queue/queue.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";

@Module({
  imports: [PrismaModule, QueueModule, OrdersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
