import request from 'supertest';
import { app } from '../src/app';
import { DatabaseManage } from '../src/core/config/database_manage';

jest.mock('../src/core/config/mail_sender', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined)
}));

const prisma = DatabaseManage.getInstance();

const cleanDatabase = async () => {
    await prisma.archivoProyecto.deleteMany();
    await prisma.participanteSesion.deleteMany();
    await prisma.sesionColaborativa.deleteMany();
    await prisma.sesionUsuario.deleteMany();
    await prisma.revokedToken.deleteMany();
    await prisma.user.deleteMany();
};

describe('HU-04: Session Creation Endpoints Integration Tests', () => {
    let authToken: string;
    let userId: string;

    const testUser = {
        email: 'sessionowner@example.com',
        password: 'Password123!',
        fullName: 'Session Owner User',
        birthDate: '1995-04-10T00:00:00.000Z',
        role: {
            name: 'CUSTOMER'
        }
    };

    beforeAll(async () => {
        await prisma.$connect();
        await cleanDatabase();

        // 1. Registrar usuario para las pruebas
        const registerRes = await request(app)
            .post('/api/v1/auth/register')
            .send(testUser);

        expect(registerRes.status).toBe(201);
        expect(registerRes.body.data).toHaveProperty('accessToken');
        authToken = registerRes.body.data.accessToken;

        // Obtener ID del usuario registrado
        const createdUser = await prisma.user.findUnique({
            where: { email: testUser.email }
        });
        expect(createdUser).toBeDefined();
        userId = createdUser!.id;
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

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
                nombre: 'a', // menor a 3 caracteres
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

        // Validar transacción de Prisma: SesionColaborativa
        const dbSession = await prisma.sesionColaborativa.findUnique({
            where: { id: sessionId },
            include: {
                participantes: true,
                archivoProyecto: true
            }
        });

        expect(dbSession).toBeDefined();
        expect(dbSession?.propietarioId).toBe(userId);

        // Validar transacción de Prisma: ParticipanteSesion con rol PROPIETARIO
        expect(dbSession?.participantes).toHaveLength(1);
        expect(dbSession?.participantes[0].usuarioId).toBe(userId);
        expect(dbSession?.participantes[0].rol).toBe('PROPIETARIO');
        expect(dbSession?.participantes[0].activo).toBe(true);

        // Validar transacción de Prisma: ArchivoProyecto inicial
        expect(dbSession?.archivoProyecto).toBeDefined();
        expect(dbSession?.archivoProyecto?.html).toContain('<!DOCTYPE html>');
        expect(dbSession?.archivoProyecto?.css).toBeDefined();
        expect(dbSession?.archivoProyecto?.javascript).toBeDefined();
    });
});
