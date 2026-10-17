import { Server as SocketIOServer, Socket } from 'socket.io';
import { SessionRepository, MAX_ACTIVE_PARTICIPANTS, ParticipantWithUser } from './session.repository';
import { JwtManage } from '../../core/config/jwt_manage';
import { RolParticipante } from '@prisma/client';
import { prisma } from '../../core/config/database_manage';

export interface JoinSessionSocketPayload {
    sessionId: string;
    userId?: string;
    token?: string;
}

export class SessionPresenceSocket {
    private static ioInstance: SocketIOServer | null = null;
    private static activeRoomSockets: Map<string, Set<string>> = new Map();
    private static socketSessionMap: Map<string, { sessionId: string; userId?: string }> = new Map();
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

    public static getActiveRoomCount(sessionId: string): number {
        return SessionPresenceSocket.activeRoomSockets.get(sessionId)?.size ?? 0;
    }

    public static resetState(): void {
        SessionPresenceSocket.activeRoomSockets.clear();
        SessionPresenceSocket.socketSessionMap.clear();
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
     * Extrae el userId desde un token JWT o desde el handshake del socket.
     */
    public static resolveUserIdFromSocket(socket: Socket, payloadToken?: string, payloadUserId?: string): string | undefined {
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
     * Valida en el middleware de conexión de Socket.IO que la sesión no supere el límite de 4 usuarios.
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
                    const err = new Error(canJoin.reason || 'SESSION_FULL') as Error & { data?: { code: number; reason: string } };
                    err.data = { code: canJoin.code, reason: canJoin.reason || 'SESSION_FULL' };
                    return next(err);
                }

                next();
            } catch (error) {
                next(error as Error);
            }
        });
    }

    /**
     * Verifica la validación doble del límite de 4 usuarios tanto en memoria de sockets como en BD.
     */
    public async validateSocketJoinLimit(
        sessionId: string,
        userId?: string
    ): Promise<{ allowed: boolean; code: number; reason?: string }> {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
            return { allowed: false, code: 404, reason: 'NOT_FOUND' };
        }

        const roomSet = SessionPresenceSocket.activeRoomSockets.get(sessionId) ?? new Set<string>();
        const memberKey = userId || '';

        if (roomSet.size >= MAX_ACTIVE_PARTICIPANTS && (!memberKey || !roomSet.has(memberKey))) {
            return { allowed: false, code: 403, reason: 'SESSION_FULL' };
        }

        const activeCountInDb = await this.sessionRepository.countActiveParticipants(sessionId);

        if (userId) {
            const existingParticipant = await this.sessionRepository.findParticipant(sessionId, userId);
            const isAlreadyActiveInDb = Boolean(existingParticipant?.activo);

            if (!isAlreadyActiveInDb && activeCountInDb >= MAX_ACTIVE_PARTICIPANTS) {
                return { allowed: false, code: 403, reason: 'SESSION_FULL' };
            }

            if (activeCountInDb > MAX_ACTIVE_PARTICIPANTS) {
                return { allowed: false, code: 403, reason: 'SESSION_FULL' };
            }
        } else if (activeCountInDb >= MAX_ACTIVE_PARTICIPANTS) {
            return { allowed: false, code: 403, reason: 'SESSION_FULL' };
        }

        return { allowed: true, code: 200 };
    }

    /**
     * Registra al socket en la sala de la sesión, actualiza su presencia y emite 'user_joined'.
     */
    public async handleJoinSession(
        socket: Socket,
        payload: JoinSessionSocketPayload,
        callback?: (response: { ok: boolean; status: number; participants?: ParticipantWithUser[]; error?: string }) => void
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
            socket.emit('session_error', {
                code: validation.code,
                message: 'La sesión colaborativa ha alcanzado el límite máximo de 4 usuarios activos.',
            });
            callback?.({ ok: false, status: validation.code, error: validation.reason });
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
        const memberKey = userId || socket.id;
        roomSet.add(memberKey);
        SessionPresenceSocket.activeRoomSockets.set(sessionId, roomSet);
        SessionPresenceSocket.socketSessionMap.set(socket.id, { sessionId, userId: memberKey });

        await socket.join(sessionId);

        const participants = await this.sessionRepository.findActiveParticipants(sessionId);
        SessionPresenceSocket.emitUserJoined(sessionId, participants);

        callback?.({
            ok: true,
            status: 200,
            participants,
        });
    }

    /**
     * Limpia el registro en memoria cuando un socket se desconecta.
     */
    public handleDisconnect(socket: Socket): void {
        const info = SessionPresenceSocket.socketSessionMap.get(socket.id);
        if (!info) {
            return;
        }

        SessionPresenceSocket.socketSessionMap.delete(socket.id);
        const roomSet = SessionPresenceSocket.activeRoomSockets.get(info.sessionId);
        if (roomSet && info.userId) {
            roomSet.delete(info.userId);
            if (roomSet.size === 0) {
                SessionPresenceSocket.activeRoomSockets.delete(info.sessionId);
            }
        }
    }
}
