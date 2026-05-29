FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Install system deps needed by some native modules
RUN apk add --no-cache openssl

# Copy workspace manifests first for better layer caching
COPY package.json bun.lockb ./
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma Client
RUN cd packages/database && bunx prisma generate

# Make entrypoint executable
RUN chmod +x /app/apps/api/entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/apps/api/entrypoint.sh"]
