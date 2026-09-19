import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createRedisConnection } from './redis.connection.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: createRedisConnection(),
      }),
    }),
  ],
})
export class QueueModule {}
