import request from 'supertest';
import { app } from '../src/app';
import { DatabaseManage } from '../src/core/config/database_manage';

const prisma = DatabaseManage.getInstance();

// Helper para limpiar la DB antes de cada test
const cleanDatabase = async () => {
    await prisma.revokedToken.deleteMany();
    await prisma.user.deleteMany();
};

describe('Auth Endpoints Integration Tests', () => {
    
    beforeAll(async () => {
        await prisma.$connect();
        await cleanDatabase();
    });

    // Al final, desconectamos
    afterAll(async () => {
        await prisma.$disconnect();
    });

    // Variables para compartir entre tests (simular flujo de usuario)
    let userAccessToken: string;
    let userRefreshTokenCookie: string;

    const mockUser = {
        email: 'testuser@example.com',
        password: 'Password123!',
        fullName: 'Test User',
        birthDate: "1988-05-03T00:00:00.000Z",
        role: {
            name: "CUSTOMER"
        }
    };

    // 1. TEST DE REGISTRO
    it('POST /api/v1/auth/register - Should register a new user and return tokens', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send(mockUser);

        expect(res.status).toBe(201);
        expect(res.body.data).toHaveProperty('accessToken');
        
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toMatch(/refreshToken/);
        expect(cookies[0]).toMatch(/HttpOnly/);
    });

    // 2. TEST DE LOGIN
    it('POST /api/v1/auth/login - Should login and return access token + cookie', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: mockUser.email,
                password: mockUser.password
            });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('accessToken');

        userAccessToken = res.body.data.accessToken;
        
        const cookies = res.headers['set-cookie'];
        expect(cookies).toBeDefined();
        userRefreshTokenCookie = cookies[0];
    });

    // 3. TEST DE REFRESH TOKEN (Usando la Cookie)
    it('POST /api/v1/auth/refresh - Should return new access token using Cookie', async () => {
        await new Promise(r => setTimeout(r, 1000));

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [userRefreshTokenCookie])
            .send();

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('accessToken');
        
        // El access token debe ser diferente
        expect(res.body.data.accessToken).not.toBe(userAccessToken);
    });

    // 4. TEST DE LOGOUT
    it('POST /api/v1/auth/logout - Should revoke token and clear cookie', async () => {
        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${userAccessToken}`) // Auth header
            .set('Cookie', [userRefreshTokenCookie]) // Cookie header
            .send();

        expect(res.status).toBe(200);

        // Verificar que la cookie se limpió (Max-Age=0 o expires en el pasado)
        const rawCookies = res.headers['set-cookie'];

        // Normalizar: si es string → convertirlo a array
        const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
        
        const logoutCookie = cookies.find((c: string) => c.includes('refreshToken'));
        expect(logoutCookie).toBeDefined();
        expect(logoutCookie).toMatch(/Expires=|Max-Age=0/);
    });
});