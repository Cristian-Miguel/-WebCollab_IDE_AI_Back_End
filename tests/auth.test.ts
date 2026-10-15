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

describe('Auth Endpoints Integration Tests', () => {
    beforeAll(async () => {
        await prisma.$connect();
        await cleanDatabase();
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    let userAccessToken: string;
    let userRefreshTokenCookie: string;

    const mockUser = {
        email: 'testauthuser@example.com',
        password: 'Password123!',
        fullName: 'Test Auth User',
        birthDate: '1988-05-03T00:00:00.000Z',
        role: {
            name: 'CUSTOMER'
        }
    };

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

    it('POST /api/v1/auth/refresh - Should return new access token using Cookie', async () => {
        await new Promise(r => setTimeout(r, 1000));

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [userRefreshTokenCookie])
            .send();

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('accessToken');
        expect(res.body.data.accessToken).not.toBe(userAccessToken);
    });

    it('POST /api/v1/auth/logout - Should revoke token and clear cookie', async () => {
        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${userAccessToken}`)
            .set('Cookie', [userRefreshTokenCookie])
            .send();

        expect(res.status).toBe(200);

        const rawCookies = res.headers['set-cookie'];
        const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
        
        const logoutCookie = cookies.find((c: string) => c.includes('refreshToken'));
        expect(logoutCookie).toBeDefined();
        expect(logoutCookie).toMatch(/Expires=|Max-Age=0/);
    });
});
