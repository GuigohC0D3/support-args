#!/bin/sh
set -e

echo "⏳ Running database migrations..."
bunx prisma migrate deploy --schema /app/packages/database/prisma/schema.prisma
echo "✅ Migrations complete."

echo "🚀 Starting API..."
exec bun /app/apps/api/src/main.ts
