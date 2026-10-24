import request from 'supertest';
import { app } from '../src/app';
import { DatabaseManage } from '../src/core/config/database_manage';
import { JwtManage } from '../src/core/config/jwt_manage';
import { RedisPresenceManage, REDIS_BLACKLIST_PREFIX } from '../src/core/config/redis_manage';

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

describe('Auth Endpoints & HU-25 Redis Token Blacklist Integration Tests', () => {
    beforeAll(async () => {
        await prisma.$connect();
        await cleanDatabase();
        RedisPresenceManage.clearAll();
    });

    afterAll(async () => {
        RedisPresenceManage.clearAll();
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

    it('POST /api/v1/auth/register - Should register a new user and return tokens with jti claim', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send(mockUser);

        expect(res.status).toBe(201);
        expect(res.body.data).toHaveProperty('accessToken');

        const extracted = JwtManage.extractJtiAndExp(res.body.data.accessToken);
        expect(extracted.jti).toBeDefined();
        expect(extracted.exp).toBeDefined();
        
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

    it('POST /api/v1/auth/logout (HU-25) - Should revoke session, store jti in Redis blacklist:token:<jti> with remaining TTL, and clear cookie', async () => {
        const { jti, exp } = JwtManage.extractJtiAndExp(userAccessToken);
        expect(jti).toBeDefined();
        expect(exp).toBeDefined();
        expect(RedisPresenceManage.getBlacklistKey(jti!)).toBe(`${REDIS_BLACKLIST_PREFIX}${jti}`);

        const isBlacklistedBefore = await RedisPresenceManage.isTokenBlacklisted(jti);
        expect(isBlacklistedBefore).toBe(false);

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

        // Verify jti is now blacklisted in Redis with remaining TTL > 0
        const isBlacklistedAfter = await RedisPresenceManage.isTokenBlacklisted(jti);
        expect(isBlacklistedAfter).toBe(true);

        const remainingTtl = await RedisPresenceManage.getBlacklistTtl(jti!);
        expect(remainingTtl).toBeGreaterThan(0);
        expect(remainingTtl).toBeLessThanOrEqual(3600);
    });

    it('authMiddleware (HU-25) - Should immediately reject requests bearing a blacklisted Access Token with 401 Unauthorized', async () => {
        // Attempt to use the logged-out (blacklisted) token on protected endpoints
        const sessionRes = await request(app)
            .post('/api/v1/sessions')
            .set('Authorization', `Bearer ${userAccessToken}`)
            .send({
                nombre: 'Intento con Token Revocado',
                descripcion: 'Debe ser rechazado por la blacklist en Redis'
            });

        expect(sessionRes.status).toBe(401);
        expect(sessionRes.body).toHaveProperty('code', 'E1006');

        // Attempt to call logout again with the blacklisted token
        const secondLogoutRes = await request(app)
            .post('/api/v1/auth/logout')
            .set('Authorization', `Bearer ${userAccessToken}`)
            .send();

        expect(secondLogoutRes.status).toBe(401);
        expect(secondLogoutRes.body).toHaveProperty('code', 'E1006');
    });
});
