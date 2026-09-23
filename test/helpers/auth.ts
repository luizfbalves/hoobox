import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { TEST_USERS } from './test-db.js';

export async function loginAs(
  app: INestApplication<App>,
  username: keyof typeof TEST_USERS,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password: TEST_USERS[username].password })
    .expect(200);
  return res.body.accessToken as string;
}
