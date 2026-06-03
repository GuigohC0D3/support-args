import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let masterToken: string;
  let agentToken: string;
  let organizationId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const masterLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'master@supporthub.com', password: 'Admin@123' });
    masterToken = masterLogin.body.accessToken;

    const agentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'agent@supporthub.com', password: 'Admin@123' });
    agentToken = agentLogin.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${masterToken}`);
    organizationId = meRes.body.organizations[0]?.organizationId;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── List ────────────────────────────────────────────────────────────────

  describe('GET /organizations', () => {
    it('master admin can list all organizations', () => {
      return request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('returns 403 for non-master users', () => {
      return request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(403);
    });

    it('returns 401 without token', () => {
      return request(app.getHttpServer())
        .get('/organizations')
        .expect(401);
    });
  });

  // ─── Get one ─────────────────────────────────────────────────────────────

  describe('GET /organizations/:orgId', () => {
    it('returns org data for a member', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('id', organizationId);
          expect(res.body).toHaveProperty('name');
          expect(res.body).toHaveProperty('slug');
        });
    });
  });

  // ─── Create ──────────────────────────────────────────────────────────────

  describe('POST /organizations', () => {
    it('master admin can create organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'E2E Test Org', slug: 'e2e-test-org' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('E2E Test Org');
      expect(res.body.slug).toBe('e2e-test-org');
    });

    it('returns 409 for duplicate slug', () => {
      return request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'Another Org', slug: 'e2e-test-org' })
        .expect(409);
    });

    it('returns 400 for invalid slug format', () => {
      return request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'Bad Slug', slug: 'Has Spaces!' })
        .expect(400);
    });

    it('returns 403 for non-master users', () => {
      return request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ name: 'Agent Org', slug: 'agent-org' })
        .expect(403);
    });
  });

  // ─── Update ──────────────────────────────────────────────────────────────

  describe('PATCH /organizations/:orgId', () => {
    it('org admin can update organization name', () => {
      return request(app.getHttpServer())
        .patch(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'Updated Org Name' })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.name).toBe('Updated Org Name');
        });
    });

    it('restores original name', async () => {
      await request(app.getHttpServer())
        .patch(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'ARGs' })
        .expect(200);
    });
  });

  // ─── Invite users ────────────────────────────────────────────────────────

  describe('POST /organizations/:orgId/users/invite', () => {
    it('returns 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post(`/organizations/${organizationId}/users/invite`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ email: 'not-an-email', role: 'SUPPORT_AGENT' })
        .expect(400);
    });

    it('returns 400 for invalid role', () => {
      return request(app.getHttpServer())
        .post(`/organizations/${organizationId}/users/invite`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ email: 'new@example.com', role: 'INVALID_ROLE' })
        .expect(400);
    });

    it('returns 403 for agent trying to invite', () => {
      return request(app.getHttpServer())
        .post(`/organizations/${organizationId}/users/invite`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ email: 'someone@example.com', role: 'CLIENT' })
        .expect(403);
    });
  });

  // ─── List members ────────────────────────────────────────────────────────

  describe('GET /organizations/:orgId/users', () => {
    it('returns list of org members', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/users`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('role');
          expect(res.body[0]).toHaveProperty('user');
        });
    });
  });
});
