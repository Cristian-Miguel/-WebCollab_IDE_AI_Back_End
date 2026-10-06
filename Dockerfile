# ====================================================================
# STAGE 1: BUILDER
# ====================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm
RUN apk add --no-cache openssl libc6-compat

COPY package.json pnpm-lock.yaml ./
COPY prisma/schema.prisma ./prisma/

RUN pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig*.json ./

RUN pnpm prisma generate
RUN pnpm build

RUN pnpm prune --prod

# ====================================================================
# STAGE 2: RUNNER (Producción)
# ====================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=PROD
ENV PORT=3000

RUN apk add --no-cache openssl libc6-compat


RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/app.js"]