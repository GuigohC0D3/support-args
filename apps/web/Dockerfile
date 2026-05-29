FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

RUN bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/

# Build args para injetar em build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN cd apps/web && bunx next build

# ─── Runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
