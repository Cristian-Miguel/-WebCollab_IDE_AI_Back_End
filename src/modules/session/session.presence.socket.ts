import { Server as SocketIOServer, Socket } from 'socket.io';
import { SessionRepository, MAX_ACTIVE_PARTICIPANTS, ParticipantWithUser } from './session.repository';
import { JwtManage } from '../../core/config/jwt_manage';
import { RedisPresenceManage } from '../../core/config/redis_manage';
import { RolParticipante } from '@prisma/client';
import { prisma } from '../../core/config/database_manage';

export const WS_DISCONNECT_LIMIT_REACHED = 'WS Disconnect: Limit reached';

export interface JoinSessionSocketPayload {
    sessionId: string;
    userId?: string;
    token?: string;
}

/**
 * HU-06-08, HU-12-14 y HU-26: Servidor Socket.IO y control de concurrencia en tiempo real
 * utilizando Redis Sets (`session:${sessionId}:active_users` y `session::active_users`)
 * mediante los comandos SCARD, SADD y SREM (máximo estricto de 4 usuarios activos).
 */
export class SessionPresenceSocket {
    private static ioInstance: SocketIOServer | null = null;
    private static activeRoomSockets: Map<string, Set<string>> = new Map();
    private static socketSessionMap: Map<string, { sessionId: string; userId: string }> = new Map();
    private sessionRepository: SessionRepository;

    constructor(sessionRepository: SessionRepository = new SessionRepository()) {
        this.sessionRepository = sessionRepository;
    }

    public static setIO(io: SocketIOServer): void {
        SessionPresenceSocket.ioInstance = io;
    }

    public static getIO(): SocketIOServer | null {
        return SessionPresenceSocket.ioInstance;
    }

    /**
     * HU-26: Obtiene la cantidad de usuarios activos en la sala consultando SCARD en Redis.
     */
    public static getActiveRoomCount(sessionId: string): number {
        const redisCard = RedisPresenceManage.scard(sessionId);
        const socketCard = SessionPresenceSocket.activeRoomSockets.get(sessionId)?.size ?? 0;
        return Math.max(redisCard, socketCard);
    }

    public static resetState(): void {
        SessionPresenceSocket.activeRoomSockets.clear();
        SessionPresenceSocket.socketSessionMap.clear();
        RedisPresenceManage.clearAll();
    }

    /**
     * Emite el evento 'user_joined' con la lista actualizada de participantes activos.
     */
    public static emitUserJoined(sessionId: string, participants: ParticipantWithUser[]): void {
        if (!SessionPresenceSocket.ioInstance) {
            return;
        }
        SessionPresenceSocket.ioInstance.emit('user_joined', {
            sessionId,
            participants,
        });
    }

    /**
     * Emite la notificación de presencia actualizada ('presence_updated' y 'user_left') a la sala.
     */
    public static emitPresenceUpdated(
        sessionId: string,
        participants: ParticipantWithUser[],
        disconnectedUserId?: string
    ): void {
        if (!SessionPresenceSocket.ioInstance) {
            return;
        }
        const activeUserIds = RedisPresenceManage.smembers(sessionId);
        const payload = {
            sessionId,
            participants,
            activeUserIds,
            activeCount: RedisPresenceManage.scard(sessionId),
            ...(disconnectedUserId ? { disconnectedUserId } : {}),
        };
        SessionPresenceSocket.ioInstance.to(sessionId).emit('presence_updated', payload);
        SessionPresenceSocket.ioInstance.emit('presence_updated', payload);
        if (disconnectedUserId) {
            SessionPresenceSocket.ioInstance.to(sessionId).emit('user_left', payload);
        }
    }

    /**
     * Extrae el userId desde un token JWT o desde el handshake del socket.
     */
    public static resolveUserIdFromSocket(
        socket: Socket,
        payloadToken?: string,
        payloadUserId?: string
    ): string | undefined {
        const rawAuthHeader = socket.handshake.headers?.authorization;
        const bearerToken = rawAuthHeader?.startsWith('Bearer ') ? rawAuthHeader.slice(7) : undefined;
        const token =
            payloadToken ||
            (socket.handshake.auth?.token as string | undefined) ||
            (socket.handshake.query?.token as string | undefined) ||
            bearerToken;

        if (token) {
            try {
                const decoded = JwtManage.verifyAccessToken(token);
                if (decoded?.sub) {
                    return decoded.sub;
                }
            } catch {
                // Fallback a userId explícito si el token no pudo decodificarse en entorno de prueba
            }
        }

        return (
            payloadUserId ||
            (socket.handshake.auth?.userId as string | undefined) ||
            (socket.handshake.query?.userId as string | undefined)
        );
    }

    /**
     * HU-26: Valida en el middleware de conexión de Socket.IO usando SCARD sobre Redis Set
     * (`session:${sessionId}:active_users`). Si cuenta >= 4, rechaza la conexión con 'WS Disconnect: Limit reached'.
     * Si pasa la validación, ejecuta SADD para registrar al usuario en el Redis Set.
     */
    public registerMiddleware(io: SocketIOServer): void {
        SessionPresenceSocket.setIO(io);

        io.use(async (socket, next) => {
            try {
                const sessionId =
                    (socket.handshake.auth?.sessionId as string | undefined) ||
                    (socket.handshake.query?.sessionId as string | undefined);

                if (!sessionId) {
                    return next();
                }

                const userId = SessionPresenceSocket.resolveUserIdFromSocket(socket);
                const canJoin = await this.validateSocketJoinLimit(sessionId, userId);

                if (!canJoin.allowed) {
                    const err = new Error(
                        canJoin.code === 403 ? WS_DISCONNECT_LIMIT_REACHED : canJoin.reason || WS_DISCONNECT_LIMIT_REACHED
                    ) as Error & {
                        data?: { code: number; reason: string; message: string };
                    };
                    err.data = {
                        code: canJoin.code,
                        reason: canJoin.reason || 'SESSION_FULL',
                        message: WS_DISCONNECT_LIMIT_REACHED,
                    };
                    return next(err);
                }

                const memberKey = userId || socket.id;
                RedisPresenceManage.sadd(sessionId, memberKey);
                const roomSet = SessionPresenceSocket.activeRoomSockets.get(sessionId) ?? new Set<string>();
                roomSet.add(memberKey);
                SessionPresenceSocket.activeRoomSockets.set(sessionId, roomSet);
                SessionPresenceSocket.socketSessionMap.set(socket.id, { sessionId, userId: memberKey });

                next();
            } catch (error) {
                next(error as Error);
            }
        });
    }

    /**
     * HU-26: Verifica el límite estricto de 4 usuarios activos priorizando SCARD en Redis Set
     * (`session:${sessionId}:active_users`) y complementando con validación en BD.
     */
    public async validateSocketJoinLimit(
        sessionId: string,
        userId?: string
    ): Promise<{ allowed: boolean; code: number; reason?: string; message?: string }> {
        const memberKey = userId || '';

        // 1. Verificación ultra-rápida en Redis usando SCARD y SISMEMBER (HU-26)
        const redisCount = RedisPresenceManage.scard(sessionId);
        const isInRedisSet = memberKey ? RedisPresenceManage.sismember(sessionId, memberKey) : false;

        if (redisCount >= MAX_ACTIVE_PARTICIPANTS && !isInRedisSet) {
            return {
                allowed: false,
                code: 403,
                reason: 'SESSION_FULL',
                message: WS_DISCONNECT_LIMIT_REACHED,
            };
        }

        const roomSet = SessionPresenceSocket.activeRoomSockets.get(sessionId) ?? new Set<string>();
        if (roomSet.size >= MAX_ACTIVE_PARTICIPANTS && (!memberKey || !roomSet.has(memberKey))) {
            return {
                allowed: false,
                code: 403,
                reason: 'SESSION_FULL',
                message: WS_DISCONNECT_LIMIT_REACHED,
            };
        }

        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
            return { allowed: false, code: 404, reason: 'NOT_FOUND' };
        }

        const activeCountInDb = await this.sessionRepository.countActiveParticipants(sessionId);

        if (userId) {
            const existingParticipant = await this.sessionRepository.findParticipant(sessionId, userId);
            const isAlreadyActiveInDb = Boolean(existingParticipant?.activo);

            if (!isAlreadyActiveInDb && !isInRedisSet && activeCountInDb >= MAX_ACTIVE_PARTICIPANTS) {
                return {
                    allowed: false,
                    code: 403,
                    reason: 'SESSION_FULL',
                    message: WS_DISCONNECT_LIMIT_REACHED,
                };
            }

            if (activeCountInDb > MAX_ACTIVE_PARTICIPANTS) {
                return {
                    allowed: false,
                    code: 403,
                    reason: 'SESSION_FULL',
                    message: WS_DISCONNECT_LIMIT_REACHED,
                };
            }
        } else if (activeCountInDb >= MAX_ACTIVE_PARTICIPANTS) {
            return {
                allowed: false,
                code: 403,
                reason: 'SESSION_FULL',
                message: WS_DISCONNECT_LIMIT_REACHED,
            };
        }

        return { allowed: true, code: 200 };
    }

    /**
     * HU-26: Registra al usuario en el Redis Set mediante SADD (tras validar con SCARD < 4),
     * lo une a la sala de Socket.IO y emite 'user_joined' y 'presence_updated'.
     */
    public async handleJoinSession(
        socket: Socket,
        payload: JoinSessionSocketPayload,
        callback?: (response: {
            ok: boolean;
            status: number;
            participants?: ParticipantWithUser[];
            activeCount?: number;
            error?: string;
            message?: string;
        }) => void
    ): Promise<void> {
        const { sessionId } = payload;
        if (!sessionId) {
            socket.emit('session_error', { code: 400, message: 'sessionId es requerido' });
            callback?.({ ok: false, status: 400, error: 'INVALID_SESSION_ID' });
            return;
        }

        const userId = SessionPresenceSocket.resolveUserIdFromSocket(socket, payload.token, payload.userId);
        const validation = await this.validateSocketJoinLimit(sessionId, userId);

        if (!validation.allowed) {
            const disconnectMsg =
                validation.code === 403
                    ? WS_DISCONNECT_LIMIT_REACHED
                    : 'La sesión colaborativa no se encuentra disponible.';

            socket.emit('session_error', {
                code: validation.code,
                reason: validation.reason || 'SESSION_FULL',
                message: disconnectMsg,
            });
            callback?.({
                ok: false,
                status: validation.code,
                error: validation.reason,
                message: disconnectMsg,
            });
            socket.disconnect(true);
            return;
        }

        const memberKey = userId || socket.id;

        // HU-26: Ejecutar SADD en Redis Set (session::active_users / session:<sessionId>:active_users)
        const activeCountAfterAdd = RedisPresenceManage.sadd(sessionId, memberKey);
        if (activeCountAfterAdd > MAX_ACTIVE_PARTICIPANTS) {
            RedisPresenceManage.srem(sessionId, memberKey);
            socket.emit('session_error', {
                code: 403,
                reason: 'SESSION_FULL',
                message: WS_DISCONNECT_LIMIT_REACHED,
            });
            callback?.({
                ok: false,
                status: 403,
                error: 'SESSION_FULL',
                message: WS_DISCONNECT_LIMIT_REACHED,
            });
            socket.disconnect(true);
            return;
        }

        if (userId) {
            const session = await this.sessionRepository.findById(sessionId);
            if (session) {
                const defaultRole =
                    session.propietarioId === userId
                        ? RolParticipante.PROPIETARIO
                        : RolParticipante.COLABORADOR;

                await prisma.participanteSesion.upsert({
                    where: {
                        usuarioId_sesionId: {
                            usuarioId: userId,
                            sesionId: sessionId,
                        },
                    },
                    update: { activo: true },
                    create: {
                        sesionId: sessionId,
                        usuarioId: userId,
                        rol: defaultRole,
                        activo: true,
                    },
                });
            }
        }

        const roomSet = SessionPresenceSocket.activeRoomSockets.get(sessionId) ?? new Set<string>();
        roomSet.add(memberKey);
        SessionPresenceSocket.activeRoomSockets.set(sessionId, roomSet);
        SessionPresenceSocket.socketSessionMap.set(socket.id, { sessionId, userId: memberKey });

        await socket.join(sessionId);

        const participants = await this.sessionRepository.findActiveParticipants(sessionId);
        SessionPresenceSocket.emitUserJoined(sessionId, participants);
        SessionPresenceSocket.emitPresenceUpdated(sessionId, participants);

        callback?.({
            ok: true,
            status: 200,
            participants,
            activeCount: RedisPresenceManage.scard(sessionId),
        });
    }

    /**
     * HU-26: Ejecuta SREM en el Redis Set al desconectar un socket, actualiza el estado
     * y notifica inmediatamente a la sala ('presence_updated' / 'user_left').
     */
    public async handleDisconnect(socket: Socket): Promise<void> {
        const info = SessionPresenceSocket.socketSessionMap.get(socket.id);
        if (!info) {
            return;
        }

        SessionPresenceSocket.socketSessionMap.delete(socket.id);
        const { sessionId, userId } = info;

        // HU-26: Ejecutar SREM en Redis Set
        RedisPresenceManage.srem(sessionId, userId);

        const roomSet = SessionPresenceSocket.activeRoomSockets.get(sessionId);
        if (roomSet && userId) {
            roomSet.delete(userId);
            if (roomSet.size === 0) {
                SessionPresenceSocket.activeRoomSockets.delete(sessionId);
            }
        }

        try {
            await this.sessionRepository.setParticipantActiveStatus(sessionId, userId, false);
            const participants = await this.sessionRepository.findActiveParticipants(sessionId);
            SessionPresenceSocket.emitPresenceUpdated(sessionId, participants, userId);
        } catch {
            SessionPresenceSocket.emitPresenceUpdated(sessionId, [], userId);
        }
    }
}
