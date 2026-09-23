import { readNonNegativeNumberEnv } from '../../../core/utils/env.js';

export function resolveProcessingDelayMs(): number {
  return readNonNegativeNumberEnv('ORDER_PROCESSING_DELAY_MS', 1000 + Math.random() * 1000);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
