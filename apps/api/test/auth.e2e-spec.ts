import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Testes E2E de autenticação.
 * Requer DATABASE_URL e REDIS_URL configurados (use docker compose up postgres redis -d).
 * Rode com: bun run test:e2e
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /health', () => {
    it('retorna status ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  describe('POST /auth/login', () => {
    it('retorna 401 para credenciais inválidas', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'naoexiste@test.com', password: 'wrong' })
        .expect(401);
    });

    it('retorna 400 para body inválido (email malformado)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nao-e-um-email', password: '123456' })
        .expect(400);
    });

    it('retorna tokens para credenciais válidas do seed', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'master@supporthub.com', password: 'Admin@123' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });
  });

  describe('GET /users/me', () => {
    it('retorna 401 sem token', () => {
      return request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('retorna perfil do usuário autenticado', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('master@supporthub.com');
          expect(res.body).not.toHaveProperty('passwordHash');
        });
    });
  });

  describe('POST /auth/refresh', () => {
    it('retorna novos tokens com refreshToken válido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // Atualiza tokens para próximos testes
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('retorna 401 para refreshToken inválido', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'token-invalido-qualquer' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('invalida o refreshToken', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);

      // Token revogado — refresh deve falhar
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
