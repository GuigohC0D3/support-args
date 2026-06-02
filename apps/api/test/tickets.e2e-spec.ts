import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let organizationId: string;
  let projectId: string;
  let ticketId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    // Login como master admin
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'master@supporthub.com', password: 'Admin@123' });

    accessToken = loginRes.body.accessToken;

    // Buscar perfil para pegar orgId e projectId
    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    organizationId = meRes.body.organizations[0]?.organizationId;

    const projectsRes = await request(app.getHttpServer())
      .get(`/organizations/${organizationId}/projects`)
      .set('Authorization', `Bearer ${accessToken}`);

    projectId = projectsRes.body[0]?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tickets', () => {
    it('retorna 400 para body inválido', () => {
      return request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'curto' }) // falta description, projectId, organizationId
        .expect(400);
    });

    it('cria ticket com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId,
          projectId,
          title: 'Ticket de teste E2E',
          description: 'Descrição detalhada do ticket criado pelo teste automatizado.',
          priority: 'HIGH',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Ticket de teste E2E');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.number).toBeGreaterThan(0);

      ticketId = res.body.id;
    });
  });

  describe('GET /tickets', () => {
    it('lista tickets da organização', () => {
      return request(app.getHttpServer())
        .get(`/tickets?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('filtra por status', () => {
      return request(app.getHttpServer())
        .get(`/tickets?organizationId=${organizationId}&status=OPEN`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          res.body.data.forEach((t: any) => {
            expect(t.status).toBe('OPEN');
          });
        });
    });

    it('retorna 401 sem token', () => {
      return request(app.getHttpServer()).get('/tickets').expect(401);
    });
  });

  describe('GET /tickets/:id', () => {
    it('retorna detalhe com histórico e comentários', () => {
      return request(app.getHttpServer())
        .get(`/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.id).toBe(ticketId);
          expect(res.body).toHaveProperty('comments');
          expect(res.body).toHaveProperty('history');
          expect(res.body.history.length).toBeGreaterThan(0); // tem o CREATED
        });
    });

    it('retorna 404 para id inexistente', () => {
      return request(app.getHttpServer())
        .get('/tickets/id-que-nao-existe')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /tickets/:id', () => {
    it('atualiza status do ticket', () => {
      return request(app.getHttpServer())
        .patch(`/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.status).toBe('IN_PROGRESS');
        });
    });
  });

  describe('POST /tickets/:id/comments', () => {
    it('adiciona comentário público', () => {
      return request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'Estamos investigando o problema.', type: 'PUBLIC' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body.body).toBe('Estamos investigando o problema.');
          expect(res.body.type).toBe('PUBLIC');
        });
    });

    it('adiciona comentário interno', () => {
      return request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'Nota interna da equipe.', type: 'INTERNAL' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body.type).toBe('INTERNAL');
        });
    });
  });

  describe('GET /tickets/:id/history', () => {
    it('retorna histórico completo com múltiplas ações', () => {
      return request(app.getHttpServer())
        .get(`/tickets/${ticketId}/history`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
          const actions = res.body.map((h: any) => h.action);
          expect(actions).toContain('CREATED');
          expect(actions).toContain('STATUS_CHANGED');
          expect(actions).toContain('COMMENTED');
        });
    });
  });
});
