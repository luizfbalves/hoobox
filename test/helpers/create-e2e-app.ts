import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { configureApp } from '../../src/app.setup.js';

export async function createE2eApp(): Promise<INestApplication<App>> {
  const { AppModule } = await import('../../src/app.module.js');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>({
    bufferLogs: true,
  });
  configureApp(app);
  await app.init();
  return app;
}
