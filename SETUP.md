# Setup

## Desenvolvimento local

```bash
# 1. Copiar env e preencher os secrets obrigatórios
cp .env.example .env

# Gerar secrets (rode cada um e cole no .env)
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 64   # JWT_REFRESH_SECRET
openssl rand -base64 32   # NEXTAUTH_SECRET

# 2. Subir infra
docker compose up postgres redis -d

# 3. Instalar dependências
bun install

# 4. Migrations + seed (apenas na primeira vez)
bun run db:migrate
bun run db:generate
bun run db:seed

# 5. Iniciar em dev
bun run dev
```

- API: http://localhost:3001
- Web: http://localhost:3000
- Swagger: http://localhost:3001/docs
- Health: http://localhost:3001/health

## Deploy completo (Docker)

```bash
# Preencher o .env com as URLs de produção e secrets fortes
# NEXTAUTH_URL=https://seudominio.com
# WEB_URL=https://seudominio.com
# NEXT_PUBLIC_API_URL=https://api.seudominio.com

docker compose up --build -d
```

O entrypoint da API roda as migrations automaticamente antes de subir.

## Credenciais do seed

| Usuário       | Email                 | Senha     |
|---------------|-----------------------|-----------|
| Master Admin  | master@supporthub.com | Admin@123 |
| Support Agent | agent@supporthub.com  | Admin@123 |
| Client        | client@supporthub.com | Admin@123 |
