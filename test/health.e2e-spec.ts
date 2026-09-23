import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createE2eApp } from './helpers/create-e2e-app.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it('gera x-correlation-id quando ausente', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.headers['x-correlation-id']).toMatch(UUID);
  });

  it('devolve o x-correlation-id recebido quando válido', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-correlation-id', 'abc-123')
      .expect(200);
    expect(res.headers['x-correlation-id']).toBe('abc-123');
  });

  it('substitui x-correlation-id inválido por UUID', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-correlation-id', 'a'.repeat(100))
      .expect(200);
    expect(res.headers['x-correlation-id']).toMatch(UUID);
  });
});
