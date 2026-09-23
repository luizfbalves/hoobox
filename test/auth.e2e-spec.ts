import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { loginAs } from './helpers/auth.js';
import { createE2eApp } from './helpers/create-e2e-app.js';
import { getTestPrisma, seedTestUsers } from './helpers/test-db.js';

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await seedTestUsers(prisma);
    app = await createE2eApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const getOrders = (authorization?: string) => {
    const req = request(app.getHttpServer()).get('/orders');
    return authorization ? req.set('Authorization', authorization) : req;
  };

  it('login válido devolve accessToken que libera rotas protegidas', async () => {
    const token = await loginAs(app, 'user');
    await getOrders(`Bearer ${token}`).expect(200);
  });

  it('senha errada e usuário inexistente respondem 401 com a mesma mensagem', async () => {
    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'user', password: 'errada' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'ninguem', password: 'x' })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('sem token responde 401', async () => {
    await getOrders().expect(401);
  });

  it('token malformado responde 401', async () => {
    await getOrders('Bearer nao-e-jwt').expect(401);
  });

  it('token assinado com outro segredo responde 401', async () => {
    const forged = new JwtService({ secret: 'outro-segredo' }).sign({
      sub: '1',
      username: 'admin',
      role: 'ADMIN',
    });
    await getOrders(`Bearer ${forged}`).expect(401);
  });

  it('token expirado responde 401', async () => {
    const expired = app
      .get(JwtService)
      .sign({ sub: '1', username: 'admin', role: 'ADMIN' }, { expiresIn: -10 });
    await getOrders(`Bearer ${expired}`).expect(401);
  });

  it('token com alg "none" responde 401', async () => {
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: '1',
      username: 'admin',
      role: 'ADMIN',
    })}.`;
    await getOrders(`Bearer ${unsigned}`).expect(401);
  });

  it('/health continua público', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
