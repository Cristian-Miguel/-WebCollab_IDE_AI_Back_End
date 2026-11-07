# ====================================================================
# STAGE 1: BUILDER
# ====================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl libc6-compat

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma.config.ts ./
COPY prisma/ ./prisma/

RUN pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig*.json ./

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm prisma:generate
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm build

# ====================================================================
# STAGE 2: RUNNER (Producción / Contenedor sin root)
# ====================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache openssl libc6-compat

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=appuser:appgroup /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=appuser:appgroup /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --chown=appuser:appgroup entrypoint.sh ./entrypoint.sh

RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh && mkdir -p /app/logs && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["sh", "-c", "pnpm prisma:migrate:deploy && pnpm start"]
