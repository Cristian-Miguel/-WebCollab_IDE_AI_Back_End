import Redis from 'ioredis';

export const REDIS_BLACKLIST_PREFIX = 'blacklist:token:';

interface BlacklistEntry {
    value: string;
    expiresAtMs: number;
}

/**
 * Gestor de configuración, presencia y lista negra de tokens en Redis (HU-06-08, HU-12-14, HU-25, HU-26).
 * Soporta conexión mediante ioredis (REDIS_URL) con respaldo en memoria con TTL exacto.
 */
export class RedisPresenceManage {
    private static memoryStore: Map<string, Set<string>> = new Map();
    private static blacklistStore: Map<string, BlacklistEntry> = new Map();
    private static redisClient: Redis | null = null;
    private static connectionAttempted = false;

    public static getRedisUrl(): string {
        return process.env.REDIS_URL || 'redis://localhost:6379';
    }

    /**
     * Obtiene o inicializa el cliente ioredis de forma no bloqueante (lazyConnect).
     */
    public static getClient(): Redis | null {
        if (process.env.NODE_ENV === 'test' && !process.env.FORCE_REDIS_CONNECTION) {
            return null;
        }

        if (!RedisPresenceManage.connectionAttempted) {
            RedisPresenceManage.connectionAttempted = true;
            try {
                const client = new Redis(RedisPresenceManage.getRedisUrl(), {
                    lazyConnect: true,
                    maxRetriesPerRequest: 1,
                    enableOfflineQueue: false,
                    retryStrategy: () => null,
                });

                client.on('error', () => {
                    // Fallback transparente al almacén en memoria si Redis no está disponible localmente
                });

                RedisPresenceManage.redisClient = client;
            } catch {
                RedisPresenceManage.redisClient = null;
            }
        }

        return RedisPresenceManage.redisClient;
    }

    public static getPresenceKey(sessionId: string): string {
        return `session:${sessionId}:active_users`;
    }

    public static getBlacklistKey(jti: string): string {
        return `${REDIS_BLACKLIST_PREFIX}${jti}`;
    }

    /**
     * Calcula el TTL restante en segundos a partir del claim `exp` (segundos Unix).
     */
    public static calculateRemainingTtlSeconds(expSeconds?: number, nowMs: number = Date.now()): number {
        if (!expSeconds || typeof expSeconds !== 'number') {
            return 0;
        }
        const nowSeconds = Math.floor(nowMs / 1000);
        return Math.max(0, expSeconds - nowSeconds);
    }

    /**
     * HU-25: Guarda el `jti` del token revocado bajo la clave `blacklist:token:<jti>`
     * asignándole un TTL equivalente al tiempo restante de vida del token (en segundos).
     */
    public static async blacklistToken(jti: string, ttlSeconds: number): Promise<boolean> {
        if (!jti || ttlSeconds <= 0) {
            return false;
        }

        const key = RedisPresenceManage.getBlacklistKey(jti);
        const expiresAtMs = Date.now() + ttlSeconds * 1000;

        RedisPresenceManage.blacklistStore.set(key, {
            value: 'revoked',
            expiresAtMs,
        });

        const client = RedisPresenceManage.getClient();
        if (client && client.status === 'ready') {
            try {
                await client.set(key, 'revoked', 'EX', ttlSeconds);
            } catch {
                // Respaldo garantizado en blacklistStore
            }
        }

        return true;
    }

    /**
     * HU-25: Consulta en Redis si el `jti` del token se encuentra en la lista negra (`blacklist:token:<jti>`).
     * Verifica también la expiración del TTL.
     */
    public static async isTokenBlacklisted(jti?: string): Promise<boolean> {
        if (!jti) {
            return false;
        }

        const key = RedisPresenceManage.getBlacklistKey(jti);
        const entry = RedisPresenceManage.blacklistStore.get(key);

        if (entry) {
            if (Date.now() < entry.expiresAtMs) {
                return true;
            }
            RedisPresenceManage.blacklistStore.delete(key);
        }

        const client = RedisPresenceManage.getClient();
        if (client && client.status === 'ready') {
            try {
                const value = await client.get(key);
                return value !== null;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * Obtiene el TTL restante en segundos de un token en la blacklist.
     */
    public static async getBlacklistTtl(jti: string): Promise<number> {
        if (!jti) {
            return -2;
        }

        const key = RedisPresenceManage.getBlacklistKey(jti);
        const entry = RedisPresenceManage.blacklistStore.get(key);

        if (entry) {
            const remainingMs = entry.expiresAtMs - Date.now();
            if (remainingMs > 0) {
                return Math.ceil(remainingMs / 1000);
            }
            RedisPresenceManage.blacklistStore.delete(key);
        }

        const client = RedisPresenceManage.getClient();
        if (client && client.status === 'ready') {
            try {
                return await client.ttl(key);
            } catch {
                return -2;
            }
        }

        return -2;
    }

    public static sadd(sessionId: string, userId: string): number {
        const key = RedisPresenceManage.getPresenceKey(sessionId);
        const set = RedisPresenceManage.memoryStore.get(key) ?? new Set<string>();
        set.add(userId);
        RedisPresenceManage.memoryStore.set(key, set);
        return set.size;
    }

    public static srem(sessionId: string, userId: string): number {
        const key = RedisPresenceManage.getPresenceKey(sessionId);
        const set = RedisPresenceManage.memoryStore.get(key);
        if (!set) {
            return 0;
        }
        set.delete(userId);
        if (set.size === 0) {
            RedisPresenceManage.memoryStore.delete(key);
            return 0;
        }
        return set.size;
    }

    public static scard(sessionId: string): number {
        const key = RedisPresenceManage.getPresenceKey(sessionId);
        return RedisPresenceManage.memoryStore.get(key)?.size ?? 0;
    }

    public static smembers(sessionId: string): string[] {
        const key = RedisPresenceManage.getPresenceKey(sessionId);
        return Array.from(RedisPresenceManage.memoryStore.get(key) ?? []);
    }

    public static clearAll(): void {
        RedisPresenceManage.memoryStore.clear();
        RedisPresenceManage.blacklistStore.clear();
    }
}
