import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

export type Api = ReturnType<typeof http>;

export function http(app: INestApplication<App>, token?: string) {
  const agent = request(app.getHttpServer());
  const withAuth = (req: request.Test) =>
    token ? req.set('Authorization', `Bearer ${token}`) : req;
  return {
    get: (url: string) => withAuth(agent.get(url)),
    post: (url: string) => withAuth(agent.post(url)),
  };
}
