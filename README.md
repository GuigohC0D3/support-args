# Support Hub

SaaS multi-tenant centralizado para gestão de tickets de suporte. Múltiplas organizações compartilham a plataforma com isolamento completo de dados por tenant, controle de acesso baseado em papéis e acompanhamento de SLA em tempo real.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| API | NestJS · Bun · Prisma ORM |
| Banco de dados | PostgreSQL · Redis |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Autenticação | NextAuth.js · JWT (stateful via Redis) |
| Monorepo | Turborepo · Bun workspaces |
| Deploy | Docker Compose · Coolify |

## Estrutura do repositório

```
support-args/
├── apps/
│   ├── api/          # API REST NestJS (porta 3001)
│   └── web/          # Frontend Next.js (porta 3000)
├── packages/
│   ├── database/     # Schema Prisma, migrations, seed
│   └── types/        # Tipos TypeScript compartilhados
├── docs/             # Guias de usuário e administrador
├── docker-compose.yml
└── .env.example
```

## Primeiros passos

### Pré-requisitos

- [Bun](https://bun.sh) ≥ 1.0
- [Docker](https://www.docker.com) e Docker Compose
- `openssl` (para gerar os secrets)

### Desenvolvimento local

```bash
# 1. Copiar o arquivo de variáveis e preencher os secrets obrigatórios
cp .env.example .env

# Gerar secrets — cole cada saída no .env
openssl rand -base64 64   # → JWT_SECRET
openssl rand -base64 64   # → JWT_REFRESH_SECRET
openssl rand -base64 32   # → NEXTAUTH_SECRET

# 2. Subir a infraestrutura
docker compose up postgres redis -d

# 3. Instalar dependências
bun install

# 4. Migrations e seed (apenas na primeira vez)
bun run db:migrate
bun run db:generate
bun run db:seed

# 5. Iniciar em modo desenvolvimento
bun run dev
```

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |
| Health check | http://localhost:3001/health |

## Variáveis de ambiente

```bash
# Banco de dados
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supporthub

# Redis
REDIS_URL=redis://:redis123@localhost:6379

# JWT — gere com: openssl rand -base64 64
# Nunca reutilize o mesmo valor entre os três secrets abaixo
JWT_SECRET=
JWT_REFRESH_SECRET=

# NextAuth — gere com: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL=http://localhost:3001
```

## Módulos da API

| Módulo | Endpoints | Descrição |
|--------|-----------|-----------|
| Auth | `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` | Autenticação JWT com revogação de token via Redis |
| Usuários | `GET /users/me` `GET /users` | Perfil e listagem de usuários por organização |
| Organizações | `GET/POST /organizations` `POST /organizations/:id/members` | Gestão de tenants e convite de membros |
| Projetos | `GET/POST /projects` | Escopo de projetos por organização |
| Tickets | `GET/POST /tickets` `PATCH /tickets/:id` `POST /tickets/:id/comments` | Ciclo completo do ticket com histórico de comentários |
| Dashboard | `GET /dashboard/metrics` `GET /dashboard/sla` | Métricas agregadas e conformidade de SLA |

## Hierarquia de papéis

```
MASTER_ADMIN  →  acesso total à plataforma
   ORG_ADMIN  →  gerencia organização, membros e projetos
SUPPORT_AGENT →  atende tickets, acessa comentários internos
      CLIENT  →  cria e acompanha seus próprios tickets
```

O acesso é verificado por requisição via `RolesGuard` + decorator `@Roles()`. Todos os dados são isolados por `organizationId`.

## Páginas do frontend

| Rota | Descrição |
|------|-----------|
| `/login` | Login com credenciais |
| `/dashboard` | Visão geral de métricas e gauge de SLA |
| `/tickets` | Lista de tickets com filtros de busca, status e prioridade |
| `/tickets/new` | Formulário de criação de ticket |
| `/tickets/[id]` | Detalhe do ticket com comentários públicos e internos |

## Deploy com Docker

```bash
# Preencher o .env com os valores de produção antes de buildar
# NEXTAUTH_URL=https://seudominio.com
# NEXT_PUBLIC_API_URL=https://api.seudominio.com

docker compose up --build -d
```

O entrypoint da API executa `prisma migrate deploy` automaticamente na inicialização.

## Segurança

- `JWT_SECRET`, `JWT_REFRESH_SECRET` e `NEXTAUTH_SECRET` devem ser valores distintos
- Refresh tokens ficam armazenados no Redis e podem ser revogados no logout
- O endpoint de login tem rate limit de **5 requisições / 60 s** por IP via `ThrottlerGuard`
- `.env` está no `.gitignore` — nunca commite secrets

## Roadmap

- [ ] Upload de anexos nos tickets (validação de MIME + bloqueio de executáveis)
- [ ] Página de projetos (`/projects`)
- [ ] Página de usuários e convites (`/users`)
- [ ] Página de configurações da organização (`/settings`)
- [ ] Notificações por e-mail e in-app
- [ ] Pipeline de CI/CD com GitHub Actions
- [ ] Deploy em produção no Coolify
