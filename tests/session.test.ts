import request from 'supertest';
import http from 'http';
import { AddressInfo } from 'net';
import * as Y from 'yjs';
import { app, httpServer } from '../src/app';
import { DatabaseManage } from '../src/core/config/database_manage';
import { SessionPresenceSocket } from '../src/modules/session/session.presence.socket';
import { EditorYjsSocket } from '../src/modules/editor/editor.yjs.socket';
import { EditorService } from '../src/modules/editor/editor.service';
import { RedisPresenceManage } from '../src/core/config/redis_manage';

jest.mock('../src/core/config/mail_sender', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined)
}));

const prisma = DatabaseManage.getInstance();

const cleanDatabase = async () => {
    await prisma.sugerenciaIA.deleteMany();
    await prisma.archivoProyecto.deleteMany();
    await prisma.participanteSesion.deleteMany();
    await prisma.sesionColaborativa.deleteMany();
    await prisma.sesionUsuario.deleteMany();
    await prisma.revokedToken.deleteMany();
    await prisma.user.deleteMany();
};

const registerTestUser = async (email: string, fullName: string) => {
    const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
            email,
            password: 'Password123!',
            fullName,
            birthDate: '1995-04-10T00:00:00.000Z',
            role: { name: 'CUSTOMER' }
        });

    expect(res.status).toBe(201);
    const createdUser = await prisma.user.findUnique({ where: { email } });
    expect(createdUser).toBeDefined();

    return {
        token: res.body.data.accessToken as string,
        userId: createdUser!.id
    };
};

describe('HU-04, HU-06-08, HU-12-14 & HU-16: Session, Limit, Yjs Sync & AI Assistant Integration Tests', () => {
    let authToken: string;
    let userId: string;

    beforeAll(async () => {
        await prisma.$connect();
        await cleanDatabase();

        const owner = await registerTestUser('sessionowner@example.com', 'Session Owner User');
        authToken = owner.token;
        userId = owner.userId;
    });

    afterAll(async () => {
        SessionPresenceSocket.resetState();
        EditorYjsSocket.resetState();
        if (httpServer.listening) {
            await new Promise<void>((resolve) => httpServer.close(() => resolve()));
        }
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('HU-04: Crear Sesión Colaborativa', () => {
        it('POST /api/v1/sessions - Should fail with 401 Unauthorized if no JWT token is provided', async () => {
            const res = await request(app)
                .post('/api/v1/sessions')
                .send({
                    nombre: 'Sesión Sin Token',
                    descripcion: 'Debería fallar'
                });

            expect(res.status).toBe(401);
        });

        it('POST /api/v1/sessions - Should fail with 401 Unauthorized if JWT token is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/sessions')
                .set('Authorization', 'Bearer invalid_token_12345')
                .send({
                    nombre: 'Sesión Token Invalido',
                    descripcion: 'Debería fallar'
                });

            expect(res.status).toBe(401);
        });

        it('POST /api/v1/sessions - Should fail with 400 Bad Request when nombre is missing or too short', async () => {
            const res = await request(app)
                .post('/api/v1/sessions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    nombre: 'a',
                    descripcion: 'Nombre muy corto'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('errors');
        });

        it('POST /api/v1/sessions - Should create session and return 201 Created with UUID', async () => {
            const payload = {
                nombre: 'Sesión Colaborativa Nexo',
                descripcion: 'Proyecto de desarrollo colaborativo en tiempo real'
            };

            const res = await request(app)
                .post('/api/v1/sessions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(payload);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data.nombre).toBe(payload.nombre);
            expect(res.body.data.descripcion).toBe(payload.descripcion);
            expect(res.body.data.propietarioId).toBe(userId);
            expect(res.body.data.estado).toBe('ACTIVA');

            const sessionId = res.body.data.id;

            const dbSession = await prisma.sesionColaborativa.findUnique({
                where: { id: sessionId },
                include: {
                    participantes: true,
                    archivoProyecto: true
                }
            });

            expect(dbSession).toBeDefined();
            expect(dbSession?.propietarioId).toBe(userId);
            expect(dbSession?.participantes).toHaveLength(1);
            expect(dbSession?.participantes[0].usuarioId).toBe(userId);
            expect(dbSession?.participantes[0].rol).toBe('PROPIETARIO');
            expect(dbSession?.participantes[0].activo).toBe(true);
            expect(dbSession?.archivoProyecto).toBeDefined();
            expect(dbSession?.archivoProyecto?.html).toContain('<!DOCTYPE html>');
        });
    });

    describe('HU-06-08 & HU-12-14: Unirse a Sesión, Control de Límite (Max 4), Presencia y Yjs CRDT (< 200ms)', () => {
        let sessionId: string;
        let user2: { token: string; userId: string };
        let user3: { token: string; userId: string };
        let user4: { token: string; userId: string };
        let user5: { token: string; userId: string };

        beforeAll(async () => {
            user2 = await registerTestUser('collab2@example.com', 'Collaborator Two');
            user3 = await registerTestUser('collab3@example.com', 'Collaborator Three');
            user4 = await registerTestUser('collab4@example.com', 'Collaborator Four');
            user5 = await registerTestUser('collab5@example.com', 'Collaborator Five');

            const createRes = await request(app)
                .post('/api/v1/sessions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    nombre: 'Sala Límite 4 Usuarios',
                    descripcion: 'Prueba de control estricto de 4 usuarios'
                });

            expect(createRes.status).toBe(201);
            sessionId = createRes.body.data.id;
        });

        it('POST /api/v1/sessions/:id/join - Should fail with 401 Unauthorized without token', async () => {
            const res = await request(app).post(`/api/v1/sessions/${sessionId}/join`);
            expect(res.status).toBe(401);
        });

        it('POST /api/v1/sessions/:id/join - Should fail with 404 Not Found for non-existent session', async () => {
            const res = await request(app)
                .post('/api/v1/sessions/00000000-0000-0000-0000-000000000000/join')
                .set('Authorization', `Bearer ${user2.token}`);

            expect(res.status).toBe(404);
        });

        it('POST /api/v1/sessions/:id/join - Should allow users 2, 3, and 4 to join (count < 4) and emit user_joined', async () => {
            const emitSpy = jest.spyOn(SessionPresenceSocket, 'emitUserJoined');

            const res2 = await request(app)
                .post(`/api/v1/sessions/${sessionId}/join`)
                .set('Authorization', `Bearer ${user2.token}`);
            expect(res2.status).toBe(200);
            expect(res2.body.data.participants).toHaveLength(2);

            const res3 = await request(app)
                .post(`/api/v1/sessions/${sessionId}/join`)
                .set('Authorization', `Bearer ${user3.token}`);
            expect(res3.status).toBe(200);
            expect(res3.body.data.participants).toHaveLength(3);

            const res4 = await request(app)
                .post(`/api/v1/sessions/${sessionId}/join`)
                .set('Authorization', `Bearer ${user4.token}`);
            expect(res4.status).toBe(200);
            expect(res4.body.data.participants).toHaveLength(4);
            expect(res4.body.data.participant.activo).toBe(true);
            expect(res4.body.data.participant.rol).toBe('COLABORADOR');

            expect(emitSpy).toHaveBeenCalledWith(
                sessionId,
                expect.arrayContaining([
                    expect.objectContaining({ usuarioId: userId, activo: true, rol: 'PROPIETARIO' }),
                    expect.objectContaining({ usuarioId: user2.userId, activo: true, rol: 'COLABORADOR' }),
                    expect.objectContaining({ usuarioId: user3.userId, activo: true, rol: 'COLABORADOR' }),
                    expect.objectContaining({ usuarioId: user4.userId, activo: true, rol: 'COLABORADOR' })
                ])
            );

            emitSpy.mockRestore();
        });

        it('POST /api/v1/sessions/:id/join - Should return 403 Forbidden when count >= 4 active users', async () => {
            const res5 = await request(app)
                .post(`/api/v1/sessions/${sessionId}/join`)
                .set('Authorization', `Bearer ${user5.token}`);

            expect(res5.status).toBe(403);
        });

        it('POST /api/v1/sessions/:id/join - Should reactivate an inactive participant when count < 4', async () => {
            await prisma.participanteSesion.update({
                where: {
                    usuarioId_sesionId: {
                        usuarioId: user4.userId,
                        sesionId: sessionId
                    }
                },
                data: { activo: false }
            });

            const activeBefore = await prisma.participanteSesion.count({
                where: { sesionId: sessionId, activo: true }
            });
            expect(activeBefore).toBe(3);

            const rejoinRes = await request(app)
                .post(`/api/v1/sessions/${sessionId}/join`)
                .set('Authorization', `Bearer ${user4.token}`);

            expect(rejoinRes.status).toBe(200);
            expect(rejoinRes.body.data.participant.activo).toBe(true);
            expect(rejoinRes.body.data.participants).toHaveLength(4);
        });

        it('WebSocket Double Validation & /yjs-ws Sync (< 200ms) - Should upgrade valid participant, reject 5th user with 403, and sync Y.Doc', async () => {
            const presenceSocket = new SessionPresenceSocket();

            const allowedCheck = await presenceSocket.validateSocketJoinLimit(sessionId, user4.userId);
            expect(allowedCheck.allowed).toBe(true);
            expect(allowedCheck.code).toBe(200);

            const rejectedCheck = await presenceSocket.validateSocketJoinLimit(sessionId, user5.userId);
            expect(rejectedCheck.allowed).toBe(false);
            expect(rejectedCheck.code).toBe(403);
            expect(rejectedCheck.reason).toBe('SESSION_FULL');

            await new Promise<void>((resolve) => {
                if (!httpServer.listening) {
                    httpServer.listen(0, () => resolve());
                } else {
                    resolve();
                }
            });

            const port = (httpServer.address() as AddressInfo).port;

            const statusCode = await new Promise<number>((resolve, reject) => {
                const req = http.request({
                    port,
                    host: '127.0.0.1',
                    path: `/yjs-ws/${sessionId}?token=${encodeURIComponent(user5.token)}`,
                    headers: {
                        Connection: 'Upgrade',
                        Upgrade: 'websocket',
                        'Sec-WebSocket-Key': Buffer.from('1234567890123456').toString('base64'),
                        'Sec-WebSocket-Version': '13'
                    }
                });

                req.on('response', (res) => {
                    res.resume();
                    resolve(res.statusCode || 500);
                });

                req.on('upgrade', (_res, socket) => {
                    socket.destroy();
                    resolve(101);
                });

                req.on('error', reject);
                req.end();
            });

            expect(statusCode).toBe(403);

            const startUpgrade = performance.now();
            const validUpgradeCode = await new Promise<number>((resolve, reject) => {
                const req = http.request({
                    port,
                    host: '127.0.0.1',
                    path: `/yjs-ws/${sessionId}?token=${encodeURIComponent(user4.token)}`,
                    headers: {
                        Connection: 'Upgrade',
                        Upgrade: 'websocket',
                        'Sec-WebSocket-Key': Buffer.from('6543210987654321').toString('base64'),
                        'Sec-WebSocket-Version': '13'
                    }
                });

                req.on('response', (res) => {
                    res.resume();
                    resolve(res.statusCode || 500);
                });

                req.on('upgrade', (_res, socket) => {
                    socket.destroy();
                    resolve(101);
                });

                req.on('error', reject);
                req.end();
            });
            const upgradeLatencyMs = performance.now() - startUpgrade;

            expect(validUpgradeCode).toBe(101);
            expect(upgradeLatencyMs).toBeLessThan(200);

            const editorService = new EditorService();
            const doc1 = new Y.Doc();
            const doc2 = new Y.Doc();
            await editorService.initializeYDocForSession(sessionId, doc1);

            const syncStart = performance.now();
            const stateUpdate = Y.encodeStateAsUpdate(doc1);
            Y.applyUpdate(doc2, stateUpdate);
            const syncLatency = performance.now() - syncStart;

            expect(syncLatency).toBeLessThan(200);
            expect(doc2.getText('index.html').toString()).toContain('<!DOCTYPE html>');

            expect(RedisPresenceManage.getPresenceKey(sessionId)).toBe(`session:${sessionId}:active_users`);
            expect(RedisPresenceManage.sadd(sessionId, userId)).toBe(1);
            expect(RedisPresenceManage.scard(sessionId)).toBe(1);
            expect(RedisPresenceManage.srem(sessionId, userId)).toBe(0);
        });

        describe('HU-16: Sugerencias de Código mediante IA (POST /api/v1/ai/suggest)', () => {
            it('POST /api/v1/ai/suggest - Should fail with 401 Unauthorized without JWT', async () => {
                const res = await request(app)
                    .post('/api/v1/ai/suggest')
                    .send({
                        contextoCodigo: '<h1>Hola</h1>',
                        lenguaje: 'html',
                    });

                expect(res.status).toBe(401);
            });

            it('POST /api/v1/ai/suggest - Should fail with 400 Bad Request for invalid lenguaje', async () => {
                const res = await request(app)
                    .post('/api/v1/ai/suggest')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        contextoCodigo: 'print("hello")',
                        lenguaje: 'python',
                    });

                expect(res.status).toBe(400);
            });

            it('POST /api/v1/ai/suggest - Should generate suggestion, persist in SugerenciaIA, and return 200 OK', async () => {
                const res = await request(app)
                    .post('/api/v1/ai/suggest')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        contextoCodigo: '<main><h1>Título</h1></main>',
                        lenguaje: 'html',
                        promptUsuario: 'Agrega una sección semántica debajo del título',
                        sesionId: sessionId,
                    });

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('data');
                expect(res.body.data).toHaveProperty('id');
                expect(res.body.data.sesionId).toBe(sessionId);
                expect(res.body.data.usuarioId).toBe(userId);
                expect(res.body.data.respuesta).toContain('ai-suggested-section');
                expect(res.body.data.sugerencia).toContain('ai-suggested-section');

                const savedInDb = await prisma.sugerenciaIA.findUnique({
                    where: { id: res.body.data.id },
                });
                expect(savedInDb).toBeDefined();
                expect(savedInDb?.sesionId).toBe(sessionId);
                expect(savedInDb?.usuarioId).toBe(userId);
                expect(savedInDb?.prompt).toContain('Agrega una sección semántica debajo del título');
            });
        });
    });
});
