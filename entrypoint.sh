#!/bin/sh
set -e

echo "[ENTRYPOINT] Generating Prisma Client..."
pnpm prisma:generate

echo "[ENTRYPOINT] Applying Prisma database migrations..."
pnpm prisma:migrate:deploy

echo "[ENTRYPOINT] Starting Express server..."
exec node dist/app.js
