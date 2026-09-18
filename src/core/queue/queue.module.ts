import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createRedisConnection } from './redis.connection.js';

@Module({
  imports: [
    BullModule.forRoot({
      connection: createRedisConnection(),
    }),
  ],
})
export class QueueModule {}
