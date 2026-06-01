# Support Hub

Multi-tenant SaaS for centralised support ticket management. Multiple organisations share the platform with full row-level data isolation, role-based access control, real-time SLA tracking, in-app notifications, and an external integration API.

## Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS · Bun · Prisma ORM |
| Database | PostgreSQL · Redis |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
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
├── docs/
├── docker-compose.yml
└── .env.example
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- [Docker](https://www.docker.com) and Docker Compose
- `openssl` (to generate secrets)

### Local development

```bash
# 1. Copy the environment file and fill in required secrets
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

# 5. Start development servers
bun run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |
| Health | http://localhost:3001/health |

## Environment variables

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supporthub

# Redis
REDIS_URL=redis://:redis123@localhost:6379

# JWT — generate with: openssl rand -base64 64
# Never reuse the same value across the three secrets below
JWT_SECRET=
JWT_REFRESH_SECRET=

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL=http://localhost:3001

# SMTP (optional — emails are silently skipped if not set)
# Compatible with any SMTP provider: Gmail, Mailtrap, Resend, Brevo, etc.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Support Hub <noreply@supporthub.com>"
```

## API modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` | JWT auth with Redis-backed token revocation |
| Users | `GET /users/me` `PATCH /users/me` `GET /users/organization/:id` | Profile management and org member listing |
| Organisations | `GET/POST /organizations` `PATCH /organizations/:id` `POST /organizations/:id/users/invite` | Tenant management and member invitations |
| Projects | `GET/POST /organizations/:id/projects` `PATCH/DELETE …/:projectId` `POST …/:projectId/regenerate-key` | Project CRUD with integration API key management |
| Tickets | `GET/POST /tickets` `PATCH /tickets/:id` `POST /tickets/:id/comments` `GET /tickets/:id/history` | Full ticket lifecycle with comments and audit log |
| Dashboard | `GET /dashboard/metrics` `GET /dashboard/sla` `GET /dashboard/by-project` | Aggregated metrics and SLA compliance |
| Notifications | `GET /notifications` `PATCH /notifications/:id/read` `PATCH /notifications/read-all` `DELETE /notifications/:id` | In-app notification system |
| Integrations | `POST /integrations/tickets` `GET /integrations/track/:token` `POST /integrations/track/:token/comments` | External ticket submission and public tracking |

## Role hierarchy

```
MASTER_ADMIN  →  full platform access
   ORG_ADMIN  →  manages org, members, and projects
SUPPORT_AGENT →  handles tickets, sees internal comments
      CLIENT  →  creates and tracks their own tickets
```

Access is enforced per-request via `RolesGuard` + `@Roles()` decorator. All data is scoped by `organizationId`.

## Frontend pages

| Route | Description |
|-------|-------------|
| `/login` | Credential login with remember-me (7-day session) |
| `/dashboard` | Metrics overview and SLA gauge |
| `/tickets` | Ticket list with search, status, and priority filters |
| `/tickets/new` | Ticket creation with category selector and impact triage |
| `/tickets/[id]` | Ticket detail with public and internal comments |
| `/projects` | Project management with integration API key panel |
| `/users` | Org member management — invite, change role, remove |
| `/settings` | Organisation settings and personal profile |
| `/track/[token]` | **Public** — external client ticket tracking (no login required) |

## External integration

Any external system can submit tickets and receive email tracking links without end-users needing a Support Hub account.

### 1. Get the API key

In Support Hub → Projects → click the 🔑 icon on a project → copy the key.

### 2. Submit a ticket

```ts
const res = await fetch('https://your-supporthub.com/integrations/tickets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: process.env.SUPPORTHUB_API_KEY,
    user:   { email: currentUser.email, name: currentUser.name },
    ticket: {
      title:       'Cannot access my account',
      description: 'Detailed description of the issue...',
      category:    'ACCOUNT_ACCESS', // optional
    },
  }),
});

const { ticketId, ticketNumber, trackingUrl } = await res.json();
// trackingUrl → https://your-supporthub.com/track/{token}
```

### 3. User experience

- User receives an **automated email** with a direct link to track their ticket
- The `/track/{token}` page is fully public — no account or password needed
- Works with any email address (Gmail, Hotmail, Outlook, corporate, etc.)
- User can view status updates, read agent replies, and send messages from the page
- If the user's email already exists in the system, their account is reused

### Supported ticket categories

| Value | Label |
|-------|-------|
| `NOT_WORKING` | Not working |
| `QUESTION` | Question |
| `PAYMENTS` | Payments |
| `ACCOUNT_ACCESS` | Account / Access |
| `SUGGESTION` | Suggestion |

## Notifications

In-app notifications are delivered in real time (30 s polling) to the bell icon in the header.

| Event | Who is notified |
|-------|----------------|
| New ticket opened | All agents and admins in the org |
| Ticket assigned | Assigned agent |
| Agent replied (public) | Ticket creator (client) |
| Client replied | Assigned agent or all agents |
| Internal comment | All agents (not the client) |
| Status changed | Ticket creator + agents (on resolved/closed) |

External (integration) clients also receive **email notifications** for status changes and agent replies.

## Authentication

- Access token expires in **15 minutes** and is refreshed silently
- **Remember me** checked → session lasts **7 days**
- **Remember me** unchecked → session lasts **8 hours**
- Refresh tokens are stored in Redis and revoked on logout
- Login rate-limited to **5 requests / 60 s** per IP

## Deploy with Docker

```bash
# Fill .env with production values before building
# NEXTAUTH_URL=https://yourdomain.com
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com

docker compose up --build -d
```

The API entrypoint runs `prisma migrate deploy` automatically on startup.

## Security

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `NEXTAUTH_SECRET` must be distinct values
- Refresh tokens are stored in Redis and can be revoked on logout
- `.env` is in `.gitignore` — never commit secrets
- Integration API keys use `sk_proj_` prefix + 48 random hex characters

## Roadmap

- [ ] File attachments on tickets (MIME validation, executable blocking)
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Production deploy on Coolify
