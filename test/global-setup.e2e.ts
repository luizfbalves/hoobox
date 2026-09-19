import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MySqlContainer } from '@testcontainers/mysql';
import { RedisContainer } from '@testcontainers/redis';

const projectRoot = resolve(import.meta.dirname, '..');
const statePath = resolve(projectRoot, '.testcontainers-state.json');

let mysqlContainer: Awaited<ReturnType<MySqlContainer['start']>>;
let redisContainer: Awaited<ReturnType<RedisContainer['start']>>;

export async function setup() {
  mysqlContainer = await new MySqlContainer('mysql:8.4').start();
  redisContainer = await new RedisContainer('redis:7-alpine').start();

  const databaseUrl = mysqlContainer.getConnectionUri();
  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getPort();

  writeFileSync(
    statePath,
    JSON.stringify({
      databaseUrl,
      redisHost,
      redisPort,
      orderProcessingDelayMs: '0',
      orderQueueBackoffMs: '50',
    }),
    'utf8',
  );

  execSync('npm run prisma:generate', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  execSync('npm run prisma:deploy', {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  return async () => {
    await mysqlContainer?.stop();
    await redisContainer?.stop();
  };
}

export default setup;
