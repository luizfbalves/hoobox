import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const statePath = resolve(import.meta.dirname, '../../.testcontainers-state.json');

function loadTestcontainersState(): {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  orderProcessingDelayMs: string;
  orderQueueBackoffMs: string;
} {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8')) as {
      databaseUrl: string;
      redisHost: string;
      redisPort: number;
      orderProcessingDelayMs: string;
      orderQueueBackoffMs: string;
    };
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new Error(
        `Arquivo ${statePath} não encontrado. Rode os testes e2e com Docker disponível: ` +
          `npm run test:e2e (ou bun run test:e2e). O globalSetup em vitest.config.e2e.ts ` +
          `sobe Testcontainers e gera esse arquivo antes dos testes.`,
      );
    }
    throw new Error(
      `Não foi possível ler ${statePath}: ${error instanceof Error ? error.message : String(error)}. ` +
        `Execute npm run test:e2e com Docker em execução.`,
    );
  }
}

const state = loadTestcontainersState();

process.env.DATABASE_URL = state.databaseUrl;
process.env.REDIS_HOST = state.redisHost;
process.env.REDIS_PORT = String(state.redisPort);
process.env.ORDER_PROCESSING_DELAY_MS = state.orderProcessingDelayMs;
process.env.ORDER_QUEUE_BACKOFF_MS = state.orderQueueBackoffMs;
process.env.LOG_LEVEL = 'silent';
