import http from 'http';
import { Duplex } from 'stream';
import { createRequire } from 'module';
import * as Y from 'yjs';
import { SessionRepository, MAX_ACTIVE_PARTICIPANTS } from '../session/session.repository';
import { EditorService } from './editor.service';
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

const yWebsocketPath = customRequire.resolve('y-websocket');
const encoding = customRequire(customRequire.resolve('lib0/encoding', { paths: [yWebsocketPath] }));
const decoding = customRequire(customRequire.resolve('lib0/decoding', { paths: [yWebsocketPath] }));
const syncProtocol = customRequire(customRequire.resolve('y-protocols/sync', { paths: [yWebsocketPath] }));
const awarenessProtocol = customRequire(customRequire.resolve('y-protocols/awareness', { paths: [yWebsocketPath] }));

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/**
 * Servidor WebSocket interno en /yjs-ws para sincronización CRDT en tiempo real (< 200ms)
 * compatible con y-websocket (WebsocketProvider) y y-monaco (HU-06-08 y HU-12-14).
 */
export class EditorYjsSocket {
    private wss: WsServer;
    private sessionRepository: SessionRepository;
    private editorService: EditorService;
    private static docs: Map<string, Y.Doc> = new Map();
    private static awarenessMap: Map<string, any> = new Map();
    private static roomConnections: Map<string, Set<WsClient>> = new Map();

    constructor(
        sessionRepository: SessionRepository = new SessionRepository(),
        editorService: EditorService = new EditorService()
    ) {
        this.sessionRepository = sessionRepository;
        this.editorService = editorService;
        this.wss = createWebSocketServer();
    }

    public static getRoomConnectionCount(sessionId: string): number {
        return EditorYjsSocket.roomConnections.get(sessionId)?.size ?? 0;
    }

    public static resetState(): void {
        EditorYjsSocket.docs.clear();
        EditorYjsSocket.awarenessMap.clear();
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
                    void this.handleConnection(ws, sessionId);
                });
            } catch {
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
            }
        });
    }

    private async handleConnection(ws: WsClient, sessionId: string): Promise<void> {
        let doc = EditorYjsSocket.docs.get(sessionId);
        if (!doc) {
            doc = new Y.Doc();
            EditorYjsSocket.docs.set(sessionId, doc);
            await this.editorService.initializeYDocForSession(sessionId, doc);

            const awareness = new awarenessProtocol.Awareness(doc);
            EditorYjsSocket.awarenessMap.set(sessionId, awareness);

            doc.on('update', (update: Uint8Array, origin: unknown) => {
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, MESSAGE_SYNC);
                syncProtocol.writeUpdate(encoder, update);
                const message = encoding.toUint8Array(encoder);

                const roomClients = EditorYjsSocket.roomConnections.get(sessionId);
                if (roomClients) {
                    for (const client of roomClients) {
                        if (client !== origin && client.readyState === 1) {
                            client.send(message);
                        }
                    }
                }
            });
        }

        const awareness = EditorYjsSocket.awarenessMap.get(sessionId);
        const clients = EditorYjsSocket.roomConnections.get(sessionId) ?? new Set<WsClient>();
        clients.add(ws);
        EditorYjsSocket.roomConnections.set(sessionId, clients);

        // Enviar SyncStep1 inicial según el protocolo estándar de y-websocket
        if (ws.readyState === 1) {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);
            syncProtocol.writeSyncStep1(encoder, doc);
            ws.send(encoding.toUint8Array(encoder));

            if (awareness && awareness.getStates().size > 0) {
                const awarenessEncoder = encoding.createEncoder();
                encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
                encoding.writeVarUint8Array(
                    awarenessEncoder,
                    awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()))
                );
                ws.send(encoding.toUint8Array(awarenessEncoder));
            }
        }

        ws.on('message', (rawMessage: Buffer | ArrayBuffer | Uint8Array) => {
            try {
                const message = new Uint8Array(
                    rawMessage instanceof ArrayBuffer
                        ? rawMessage
                        : ArrayBuffer.isView(rawMessage)
                        ? rawMessage.buffer.slice(rawMessage.byteOffset, rawMessage.byteOffset + rawMessage.byteLength)
                        : rawMessage
                );

                if (message.byteLength === 0 || !doc) {
                    return;
                }

                const decoder = decoding.createDecoder(message);
                const messageType = decoding.readVarUint(decoder);

                if (messageType === MESSAGE_SYNC) {
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, MESSAGE_SYNC);
                    syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
                    if (encoding.length(encoder) > 1 && ws.readyState === 1) {
                        ws.send(encoding.toUint8Array(encoder));
                    }
                } else if (messageType === MESSAGE_AWARENESS && awareness) {
                    const update = decoding.readVarUint8Array(decoder);
                    awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);

                    const roomClients = EditorYjsSocket.roomConnections.get(sessionId);
                    if (roomClients) {
                        for (const client of roomClients) {
                            if (client !== ws && client.readyState === 1) {
                                client.send(message);
                            }
                        }
                    }
                }
            } catch {
                // Fallback para actualizaciones binarias directas de Yjs
                try {
                    const rawUpdate = new Uint8Array(
                        rawMessage instanceof ArrayBuffer
                            ? rawMessage
                            : ArrayBuffer.isView(rawMessage)
                            ? rawMessage.buffer.slice(rawMessage.byteOffset, rawMessage.byteOffset + rawMessage.byteLength)
                            : rawMessage
                    );
                    if (doc && rawUpdate.byteLength > 0) {
                        Y.applyUpdate(doc, rawUpdate, ws);
                    }
                } catch {
                    // Ignorar tramas inválidas
                }
            }
        });

        ws.on('close', () => {
            const roomClients = EditorYjsSocket.roomConnections.get(sessionId);
            if (roomClients) {
                roomClients.delete(ws);
                if (roomClients.size === 0) {
                    EditorYjsSocket.roomConnections.delete(sessionId);
                    if (doc) {
                        void this.editorService.persistYDocState(sessionId, doc).catch(() => {});
                    }
                }
            }
        });
    }
}
