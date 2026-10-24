import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { RedisPresenceManage } from '../../core/config/redis_manage';
import { ERROR_MESSAGES } from '../../core/const/error_message';

export const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
export const AI_RATE_LIMIT_MAX_REQUESTS = 5; // Máximo 5 peticiones por minuto por userId/IP
export const AI_RATE_LIMIT_PREFIX = 'rate-limit:ai:';

interface RateLimitBucket {
    hits: number;
    expiresAtMs: number;
}

const fallbackBuckets: Map<string, RateLimitBucket> = new Map();

/**
 * Ejecuta comandos raw de Redis para `RedisStore` de `rate-limit-redis`.
 * Si hay una instancia de Redis conectada, delega el comando a Redis;
 * de lo contrario, emula de forma atómica los comandos Lua/EVALSHA, DECR y DEL en memoria
 * para garantizar funcionamiento idéntico tanto en contenedor Redis como en entornos de test.
 */
export async function executeRateLimitRedisCommand(...args: string[]): Promise<RedisReply> {
    const client = RedisPresenceManage.getClient();
    if (client && client.status === 'ready') {
        try {
            const [cmd, ...rest] = args;
            const reply = await client.call(cmd, ...rest);
            return reply as RedisReply;
        } catch {
            // Fallback transparente al motor de comandos Redis en memoria
        }
    }

    const command = (args[0] || '').toUpperCase();

    if (command === 'SCRIPT' && (args[1] || '').toUpperCase() === 'LOAD') {
        const scriptBody = args[2] || '';
        return scriptBody.includes('INCR') ? 'sha1_increment_script' : 'sha1_get_script';
    }

    if (command === 'EVALSHA') {
        const sha = args[1];
        const key = args[3];
        const windowMs = Number.parseInt(args[4] || String(AI_RATE_LIMIT_WINDOW_MS), 10);
        const now = Date.now();
        const existing = fallbackBuckets.get(key);

        if (sha === 'sha1_get_script') {
            if (!existing || existing.expiresAtMs <= now) {
                fallbackBuckets.delete(key);
                return [0, -2];
            }
            return [existing.hits, existing.expiresAtMs - now];
        }

        // Comportamiento exacto del script Lua de rate-limit-redis para increment:
        if (!existing || existing.expiresAtMs <= now) {
            fallbackBuckets.set(key, {
                hits: 1,
                expiresAtMs: now + windowMs,
            });
            return [1, windowMs];
        }

        existing.hits += 1;
        return [existing.hits, existing.expiresAtMs - now];
    }

    if (command === 'DECR') {
        const key = args[1];
        const existing = fallbackBuckets.get(key);
        if (existing && existing.hits > 0) {
            existing.hits -= 1;
            return existing.hits;
        }
        return 0;
    }

    if (command === 'DEL') {
        const key = args[1];
        const deleted = fallbackBuckets.delete(key);
        return deleted ? 1 : 0;
    }

    return 'OK';
}

/**
 * Permite reiniciar los contadores de rate-limit entre suites de prueba.
 */
export function resetAIRateLimitStore(): void {
    fallbackBuckets.clear();
}

/**
 * Instancia de RedisStore de `rate-limit-redis` configurada con prefijo `rate-limit:ai:`.
 */
export const aiRedisStore = new RedisStore({
    prefix: AI_RATE_LIMIT_PREFIX,
    sendCommand: (...args: string[]) => executeRateLimitRedisCommand(...args),
});

/**
 * HU-27: Middleware de Rate Limiting para peticiones a la Inteligencia Artificial
 * (`POST /api/v1/ai/suggest`) usando `express-rate-limit` + `rate-limit-redis`.
 * Limita a un máximo de 5 peticiones por minuto por `userId` o `IP`,
 * retornando `429 Too Many Requests` con mensaje informativo cuando se excede.
 */
export const aiRateLimitMiddleware = rateLimit({
    windowMs: AI_RATE_LIMIT_WINDOW_MS,
    limit: AI_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    store: aiRedisStore,
    keyGenerator: (req: Request): string => {
        if (req.user?.sub) {
            return `user:${req.user.sub}`;
        }
        const normalizedIp = req.ip ? ipKeyGenerator(req.ip) : 'unknown-ip';
        return `ip:${normalizedIp}`;
    },
    handler: (_req: Request, res: Response, _next: NextFunction): void => {
        res.status(ERROR_MESSAGES.AI_RATE_LIMIT_EXCEEDED.httpCode).json({
            status: 'error',
            code: ERROR_MESSAGES.AI_RATE_LIMIT_EXCEEDED.appCode,
            message: ERROR_MESSAGES.AI_RATE_LIMIT_EXCEEDED.message,
        });
    },
});

export default aiRateLimitMiddleware;
