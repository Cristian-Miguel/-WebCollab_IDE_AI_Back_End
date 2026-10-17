import { Socket, Server } from 'socket.io';
import { SessionPresenceSocket, JoinSessionSocketPayload } from '../../modules/session/session.presence.socket';

/**
 * Clase para manejar los eventos de Socket.io e integrar la presencia
 * y validación de límite de sesiones colaborativas (HU-06-08).
 */
export class SocketManageEvent {
    private presenceSocket: SessionPresenceSocket;

    constructor(private socket: Socket, private io: Server) {
        this.presenceSocket = new SessionPresenceSocket();
        SessionPresenceSocket.setIO(this.io);
        this.setupListeners();
        this.handleInitialHandshakeJoin();
    }

    private handleInitialHandshakeJoin(): void {
        const sessionId =
            (this.socket.handshake.auth?.sessionId as string | undefined) ||
            (this.socket.handshake.query?.sessionId as string | undefined);

        if (sessionId) {
            void this.presenceSocket.handleJoinSession(this.socket, {
                sessionId,
                userId:
                    (this.socket.handshake.auth?.userId as string | undefined) ||
                    (this.socket.handshake.query?.userId as string | undefined),
                token:
                    (this.socket.handshake.auth?.token as string | undefined) ||
                    (this.socket.handshake.query?.token as string | undefined),
            });
        }
    }

    private setupListeners(): void {
        this.socket.on(
            'join_session',
            async (
                payload: JoinSessionSocketPayload,
                callback?: (res: { ok: boolean; status: number; participants?: unknown[]; error?: string }) => void
            ) => {
                await this.presenceSocket.handleJoinSession(this.socket, payload, callback);
            }
        );

        this.socket.on('disconnect', () => {
            this.presenceSocket.handleDisconnect(this.socket);
        });
    }
}
