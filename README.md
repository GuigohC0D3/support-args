# Support Hub

Centralized multi-tenant SaaS for support ticket management. Multiple organizations share a single platform, with full data isolation per tenant, role-based access control, and real-time SLA tracking.

## Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS · Bun · Prisma ORM |
| Database | PostgreSQL · Redis |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Auth | NextAuth.js · JWT (stateful via Redis) |
| Monorepo | Turborepo · Bun workspaces |
| Deploy | Docker Compose · Coolify |

## Repository structure

```
support-args/
├── apps/
│   ├── api/          # NestJS REST API (port 3001)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   ├── database/     # Prisma schema, migrations, seed
│   └── types/        # Shared TypeScript types
├── docs/             # User and admin guides
├── docker-compose.yml
└── .env.example
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- [Docker](https://www.docker.com) & Docker Compose
- `openssl` (for generating secrets)

### Local development

```bash
# 1. Copy and fill in the required secrets
cp .env.example .env

# Generate secrets — paste each output into .env
openssl rand -base64 64   # → JWT_SECRET
openssl rand -base64 64   # → JWT_REFRESH_SECRET
openssl rand -base64 32   # → NEXTAUTH_SECRET

# 2. Start infrastructure
docker compose up postgres redis -d

# 3. Install dependencies
bun install

# 4. Run migrations and seed (first time only)
bun run db:migrate
bun run db:generate
bun run db:seed

# 5. Start dev servers
bun run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |
| Health check | http://localhost:3001/health |

### Seed credentials

| Role | Email | Password |
|------|-------|----------|
| Master Admin | master@supporthub.com | Admin@123 |
| Support Agent | agent@supporthub.com | Admin@123 |
| Client | client@supporthub.com | Admin@123 |

## Environment variables

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supporthub

# Redis
REDIS_URL=redis://:redis123@localhost:6379

# JWT — generate with: openssl rand -base64 64
# Never reuse the same value across these three secrets
JWT_SECRET=
JWT_REFRESH_SECRET=

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL=http://localhost:3001
```

## API modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` | JWT authentication with Redis-backed token revocation |
| Users | `GET /users/me` `GET /users` | Profile and user listing per org |
| Organizations | `GET/POST /organizations` `POST /organizations/:id/members` | Tenant management and member invites |
| Projects | `GET/POST /projects` | Project scoping per organization |
| Tickets | `GET/POST /tickets` `PATCH /tickets/:id` `POST /tickets/:id/comments` | Full ticket lifecycle with comment history |
| Dashboard | `GET /dashboard/metrics` `GET /dashboard/sla` | Aggregated metrics and SLA compliance |

## Role hierarchy

```
MASTER_ADMIN  →  full platform access
   ORG_ADMIN  →  manages organization, members, projects
SUPPORT_AGENT →  handles tickets, internal comments
      CLIENT  →  creates and tracks own tickets
```

Access is enforced per-request via `RolesGuard` + `@Roles()` decorator. All data is row-level isolated by `organizationId`.

## Frontend pages

| Route | Description |
|-------|-------------|
| `/login` | Credentials login |
| `/dashboard` | Metrics overview and SLA gauge |
| `/tickets` | Ticket list with search, status, and priority filters |
| `/tickets/new` | Create ticket form |
| `/tickets/[id]` | Ticket detail with public and internal comments |

## Docker deploy

```bash
# Fill .env with production values before building
# NEXTAUTH_URL=https://yourdomain.com
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com

docker compose up --build -d
```

The API entrypoint runs `prisma migrate deploy` automatically on startup.

## Security notes

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `NEXTAUTH_SECRET` must be distinct values
- Refresh tokens are stored in Redis and revocable on logout
- Login endpoint is rate-limited to **5 requests / 60 s** per IP via `ThrottlerGuard`
- `.env` is excluded from version control — never commit secrets

## Roadmap

- [ ] File attachments on tickets (MIME validation + executable blocklist)
- [ ] Projects page (`/projects`)
- [ ] Users and invites page (`/users`)
- [ ] Organization settings page (`/settings`)
- [ ] Email and in-app notifications
- [ ] GitHub Actions CI/CD pipeline
- [ ] Coolify production deploy
