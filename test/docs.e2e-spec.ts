import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createE2eApp } from './helpers/create-e2e-app.js';

describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs-json é público e documenta rotas e bearer auth', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/auth/login',
        '/orders',
        '/orders/{id}',
        '/orders/{id}/reprocess',
        '/health',
      ]),
    );
    expect(res.body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(res.body.components.schemas.CreateOrderDto.required).toEqual(
      expect.arrayContaining(['customerName', 'items']),
    );
  });
});
