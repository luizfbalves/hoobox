import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from './correlation-id.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        ...(process.env.NODE_ENV === 'development'
          ? { transport: { target: 'pino-pretty' } }
          : {}),
        genReqId: (req, res) => {
          const id = resolveCorrelationId(req.headers[CORRELATION_ID_HEADER]);
          res.setHeader(CORRELATION_ID_HEADER, id);
          return id;
        },
        customAttributeKeys: { reqId: 'correlationId' },
        redact: ['req.headers.authorization'],
      },
    }),
  ],
})
export class LoggingModule {}
