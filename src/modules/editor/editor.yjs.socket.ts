import http from 'http';
import { Duplex } from 'stream';
import { createRequire } from 'module';
import * as Y from 'yjs';
import { SessionRepository, MAX_ACTIVE_PARTICIPANTS } from '../session/session.repository';
import { JwtManage } from '../../core/config/jwt_manage';

const customRequire = createRequire(__filename);

interface WsClient {
    readyState: number;
    send(data: Uint8Array | string): void;
    close(code?: number, reason?: string): void;
    on(event: string, listener: (...args: any[]) => void): void;
}

interface WsServer {
    handleUpgrade(
        request: http.IncomingMessage,
        socket: Duplex,
        head: Buffer,
        callback: (client: WsClient, request: http.IncomingMessage) => void
    ): void;
    emit(event: string, ...args: any[]): boolean;
}

function createWebSocketServer(): WsServer {
    const socketIoPath = customRequire.resolve('socket.io');
    const engineIoPath = customRequire.resolve('engine.io', { paths: [socketIoPath] });
    const wsPath = customRequire.resolve('ws', { paths: [engineIoPath] });
    const WebSocketPkg = customRequire(wsPath);
    const WebSocketServerClass = WebSocketPkg.WebSocketServer || WebSocketPkg.Server;
    return new WebSocketServerClass({ noServer: true });
}

/**
 * Servidor WebSocket en /yjs-ws para sincronización distribuida con Yjs (y-websocket)
 * con validación doble del límite máximo de 4 usuarios activos por sesión (HU-06-08).
 */
export class EditorYjsSocket {
    private wss: WsServer;
    private sessionRepository: SessionRepository;
    private static docs: Map<string, Y.Doc> = new Map();
    private static roomConnections: Map<string, Set<WsClient>> = new Map();

    constructor(sessionRepository: SessionRepository = new SessionRepository()) {
        this.sessionRepository = sessionRepository;
        this.wss = createWebSocketServer();
    }

    public static getRoomConnectionCount(sessionId: string): number {
        return EditorYjsSocket.roomConnections.get(sessionId)?.size ?? 0;
    }

    public static resetState(): void {
        EditorYjsSocket.docs.clear();
        EditorYjsSocket.roomConnections.clear();
    }

    /**
     * Registra el listener 'upgrade' en el servidor HTTP para la ruta /yjs-ws.
     */
    public attach(httpServer: http.Server): void {
        httpServer.on('upgrade', async (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
            const rawUrl = req.url || '';
            if (!rawUrl.startsWith('/yjs-ws')) {
                return;
            }

            try {
                const parsedUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
                const pathParts = parsedUrl.pathname.replace(/^\/yjs-ws\/?/, '').split('/').filter(Boolean);
                const sessionId = pathParts[0] || parsedUrl.searchParams.get('sessionId') || '';
                const token = parsedUrl.searchParams.get('token') || undefined;
                const queryUserId = parsedUrl.searchParams.get('userId') || undefined;

                if (!sessionId) {
                    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                    socket.destroy();
                    return;
                }

                let userId = queryUserId;
                if (token) {
                    try {
                        const payload = JwtManage.verifyAccessToken(token);
                        userId = payload.sub;
                    } catch {
                        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                        socket.destroy();
                        return;
                    }
                }

                const session = await this.sessionRepository.findById(sessionId);
                if (!session) {
                    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                    socket.destroy();
                    return;
                }

                const currentConnections = EditorYjsSocket.roomConnections.get(sessionId) ?? new Set<WsClient>();
                if (currentConnections.size >= MAX_ACTIVE_PARTICIPANTS) {
                    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\n\r\n{"code":403,"message":"SESSION_FULL"}');
                    socket.destroy();
                    return;
                }

                const activeCountInDb = await this.sessionRepository.countActiveParticipants(sessionId);
                if (userId) {
                    const participant = await this.sessionRepository.findParticipant(sessionId, userId);
                    const isAlreadyActive = Boolean(participant?.activo);
                    if ((!isAlreadyActive && activeCountInDb >= MAX_ACTIVE_PARTICIPANTS) || activeCountInDb > MAX_ACTIVE_PARTICIPANTS) {
                        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\n\r\n{"code":403,"message":"SESSION_FULL"}');
                        socket.destroy();
                        return;
                    }
                } else if (activeCountInDb >= MAX_ACTIVE_PARTICIPANTS) {
                    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\n\r\n{"code":403,"message":"SESSION_FULL"}');
                    socket.destroy();
                    return;
                }

                this.wss.handleUpgrade(req, socket, head, (ws) => {
                    this.handleConnection(ws, sessionId);
                });
            } catch {
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
            }
        });
    }

    private handleConnection(ws: WsClient, sessionId: string): void {
        let doc = EditorYjsSocket.docs.get(sessionId);
        if (!doc) {
            doc = new Y.Doc();
            EditorYjsSocket.docs.set(sessionId, doc);
        }

        const clients = EditorYjsSocket.roomConnections.get(sessionId) ?? new Set<WsClient>();
        clients.add(ws);
        EditorYjsSocket.roomConnections.set(sessionId, clients);

        // Enviar estado inicial de Y.Doc codificado al cliente conectado
        const initialState = Y.encodeStateAsUpdate(doc);
        if (ws.readyState === 1) {
            ws.send(initialState);
        }

        ws.on('message', (message: Buffer | ArrayBuffer | Uint8Array) => {
            try {
                const update = new Uint8Array(
                    message instanceof ArrayBuffer
                        ? message
                        : ArrayBuffer.isView(message)
                        ? message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength)
                        : message
                );
                if (doc && update.byteLength > 0) {
                    Y.applyUpdate(doc, update);
                }
                const roomClients = EditorYjsSocket.roomConnections.get(sessionId);
                if (roomClients) {
                    for (const client of roomClients) {
                        if (client !== ws && client.readyState === 1) {
                            client.send(update);
                        }
                    }
                }
            } catch {
                // Ignorar tramas no binarias o de ping de control
            }
        });

        ws.on('close', () => {
            const roomClients = EditorYjsSocket.roomConnections.get(sessionId);
            if (roomClients) {
                roomClients.delete(ws);
                if (roomClients.size === 0) {
                    EditorYjsSocket.roomConnections.delete(sessionId);
                }
            }
        });
    }
}
