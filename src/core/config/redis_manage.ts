/**
 * Gestor de configuración y estado de presencia con soporte para variables de entorno de Redis (REDIS_URL).
 * Mantiene sincronizadas las claves `session:<sessionId>:active_users` para control de presencia y concurrencia.
 */
export class RedisPresenceManage {
    private static memoryStore: Map<string, Set<string>> = new Map();

    public static getRedisUrl(): string {
        return process.env.REDIS_URL || 'redis://localhost:6379';
    }

    public static getPresenceKey(sessionId: string): string {
        return `session:${sessionId}:active_users`;
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
    }
}
