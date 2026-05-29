# Guia do Administrador — Support Hub

## Gerenciando usuários

### Convidar um novo membro

```
POST /organizations/:orgId/users/invite
{ "email": "novo@empresa.com", "role": "SUPPORT_AGENT" }
```

Via painel (em breve): **Usuários → Convidar membro**

### Roles disponíveis

| Role | Código |
|------|--------|
| Admin da Empresa | `ORG_ADMIN` |
| Agente de Suporte | `SUPPORT_AGENT` |
| Cliente | `CLIENT` |

### Alterar role de um membro

```
PATCH /organizations/:orgId/users/:userId/role
{ "role": "ORG_ADMIN" }
```

### Remover membro

```
DELETE /organizations/:orgId/users/:userId
```

---

## Gerenciando projetos

Cada projeto representa uma área ou produto da sua empresa.

### Criar projeto

```
POST /organizations/:orgId/projects
{ "name": "Website", "description": "Suporte ao site institucional", "color": "#6366f1" }
```

### Desativar projeto

```
DELETE /organizations/:orgId/projects/:projectId
```

Tickets existentes são mantidos — apenas novos tickets não podem ser abertos neste projeto.

---

## Dashboard e métricas

### Métricas disponíveis

```
GET /dashboard/metrics?organizationId=:id
```

Retorna: total, abertos, em andamento, aguardando cliente, resolvidos, fechados, tempo médio de primeira resposta.

```
GET /dashboard/sla?organizationId=:id
```

Retorna: compliance rate, tickets em dia, violados, em risco (próximas 2h).

```
GET /dashboard/by-project?organizationId=:id
```

Retorna: contagem de tickets agrupada por projeto.

---

## Configuração de SLA

Os prazos padrão são aplicados globalmente. Para customizar por projeto, use a API:

```
POST /sla-policies (em breve via painel)
{
  "organizationId": "...",
  "projectId": "...",        // opcional — se omitido, aplica à org toda
  "name": "SLA Premium",
  "urgentFirstResponse": 15, // minutos
  "urgentResolution": 120
}
```

---

## API pública (Swagger)

Documentação interativa disponível em:
```
http://seu-dominio.com:3001/docs
```

Todos os endpoints requerem autenticação via Bearer token (JWT).

---

## Variáveis de ambiente de produção

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Mínimo 64 bytes aleatórios — **nunca reutilizar** |
| `JWT_REFRESH_SECRET` | Mínimo 64 bytes — diferente do JWT_SECRET |
| `NEXTAUTH_SECRET` | Mínimo 32 bytes |
| `NEXTAUTH_URL` | URL pública do frontend (ex: https://suporte.empresa.com) |
| `DATABASE_URL` | Connection string PostgreSQL |
| `REDIS_URL` | Connection string Redis com senha |

Gere os secrets com:
```bash
openssl rand -base64 64
```
