import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

const VALID_CORRELATION_ID = /^[A-Za-z0-9-]{1,36}$/;

export function resolveCorrelationId(
  header: string | string[] | undefined,
): string {
  if (typeof header === 'string' && VALID_CORRELATION_ID.test(header)) {
    return header;
  }
  return randomUUID();
}
