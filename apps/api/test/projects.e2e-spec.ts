import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let masterToken: string;
  let agentToken: string;
  let clientToken: string;
  let organizationId: string;
  let createdProjectId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const [masterRes, agentRes, clientRes] = await Promise.all([
      request(app.getHttpServer()).post('/auth/login').send({ email: 'master@supporthub.com', password: 'Admin@123' }),
      request(app.getHttpServer()).post('/auth/login').send({ email: 'agent@supporthub.com', password: 'Admin@123' }),
      request(app.getHttpServer()).post('/auth/login').send({ email: 'client@supporthub.com', password: 'Admin@123' }),
    ]);

    masterToken = masterRes.body.accessToken;
    agentToken  = agentRes.body.accessToken;
    clientToken = clientRes.body.accessToken;

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${masterToken}`);
    organizationId = meRes.body.organizations[0]?.organizationId;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── List ────────────────────────────────────────────────────────────────

  describe('GET /organizations/:orgId/projects', () => {
    it('returns project list for org member', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[0]).toHaveProperty('name');
        });
    });

    it('agent can list projects', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects`)
        .set('Authorization', `Bearer ${agentToken}`)
        .expect(200);
    });

    it('returns 401 without token', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects`)
        .expect(401);
    });
  });

  // ─── Create ──────────────────────────────────────────────────────────────

  describe('POST /organizations/:orgId/projects', () => {
    it('admin can create project', async () => {
      const res = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/projects`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'E2E Project', description: 'Project created in E2E test' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('E2E Project');
      expect(res.body.organizationId).toBe(organizationId);
      createdProjectId = res.body.id;
    });

    it('returns 400 for missing name', () => {
      return request(app.getHttpServer())
        .post(`/organizations/${organizationId}/projects`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ description: 'No name provided' })
        .expect(400);
    });

    it('client cannot create project', () => {
      return request(app.getHttpServer())
        .post(`/organizations/${organizationId}/projects`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'Client Project' })
        .expect(403);
    });
  });

  // ─── Get one ─────────────────────────────────────────────────────────────

  describe('GET /organizations/:orgId/projects/:id', () => {
    it('returns project details', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.id).toBe(createdProjectId);
          expect(res.body).toHaveProperty('slaPolicy');
        });
    });

    it('returns 404 for non-existent project', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects/non-existent-id`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(404);
    });
  });

  // ─── Update ──────────────────────────────────────────────────────────────

  describe('PATCH /organizations/:orgId/projects/:id', () => {
    it('admin can update project', () => {
      return request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ name: 'Updated E2E Project', color: '#ff5500' })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.name).toBe('Updated E2E Project');
        });
    });

    it('client cannot update project', () => {
      return request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  // ─── Delete ──────────────────────────────────────────────────────────────

  describe('DELETE /organizations/:orgId/projects/:id', () => {
    it('client cannot delete project', () => {
      return request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });

    it('admin can delete project', () => {
      return request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(204);
    });

    it('returns 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${organizationId}/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${masterToken}`)
        .expect(404);
    });
  });
});
