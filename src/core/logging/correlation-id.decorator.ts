import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';

// pino-http grava o id gerado em genReqId em req.id
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<IncomingMessage & { id?: unknown }>();
    return String(request.id);
  },
);
