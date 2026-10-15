import jwt, { SignOptions } from 'jsonwebtoken';
import { LoggerManage } from './logger';
import * as dotenv from 'dotenv';

dotenv.config();

// Definición de las interfaces para los Payloads de los tokens
// El 'iss' (issuer) y 'exp' (expiration) son campos estándar de JWT
export interface AccessTokenPayload {
    sub: string;
    sessionId: string;
    email: string;
    profileImageUrl: string;
    role: string;
    type: string;
}

export interface RefreshTokenPayload {
    sub: string;
    email: string;
    type: string;
    sessionId?: string;
}

export interface SessionRefreshTokenPayload extends RefreshTokenPayload {
    sessionId: string;
}

/**
 * Clase de gestión para la creación y validación de JSON Web Tokens (JWT).
 * Se basa en las variables de entorno para las claves secretas y duraciones.
 */
export class JwtManage {

    // Claves secretas de entorno
    private static readonly SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || '';

    private static readonly ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '1h';
    private static readonly REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '30d'; 
    private static readonly ISSUER = 'YourAPI/v1'; // Identificador del emisor (issuer)
    private static readonly AUDIENCE = 'myapp-client'; // Identificador del cliente (audience)
    
    private static readonly SCOPE_VALIDATE_EMAIL = 'myapp-client'; // Identificador del cliente (audience)
    private static readonly SCOPE_CHANGE_PASSWORD = 'myapp-client'; // Identificador del cliente (audience)
    private static readonly SCOPE_REFRESH_TOKEN = 'myapp-client'; // Identificador del cliente (audience)
    private static readonly SCOPE_ACCESS_TOKEN = 'myapp-client'; // Identificador del cliente (audience)

    private static readonly EMAIL_VALIDATION_DURATION = process.env.JWT_EMAIL_VALIDATION_EXPIRATION || '1d';
    private static readonly PASSWORD_RESET_DURATION = process.env.JWT_PASSWORD_RESET_EXPIRATION ||'15m';

    /**
     * Valida la existencia de las claves secretas al iniciar el servicio.
     */
    private static validateSecrets(): void {
        if (!JwtManage.SECRET_KEY) {
            LoggerManage.error('JWT secrets are not configured in environment variables (.env)!');
            throw new Error('JWT secrets must be provided.');
        }
    }

    /**
     * Genera un token de acceso (Access Token).
     * @param userUuid UUID del usuario.
     * @param email Correo del usuario.
     * @param profileImageUrl URL de la imagen de perfil.
     * @param role Rol del usuario.
     * @returns El token de acceso firmado.
     */
    public static generateAccessToken(
        userUuid: string,
        email: string,
        profileImageUrl: string,
        role: string,
        sessionId: string
    ): string {
        JwtManage.validateSecrets();
        const payload: AccessTokenPayload = {
            sub: userUuid,
            sessionId,
            email: email,
            profileImageUrl: profileImageUrl,
            role: role,
            type: JwtManage.SCOPE_ACCESS_TOKEN
        };
        const options: SignOptions = {
            audience: JwtManage.AUDIENCE,
            issuer: JwtManage.ISSUER,
            expiresIn: JwtManage.ACCESS_EXPIRATION as SignOptions['expiresIn'],
            algorithm: 'HS256'
        };
        return jwt.sign(
            payload, 
            JwtManage.SECRET_KEY, 
            options
        );
    }

    /**
     * Genera un token de refresco (Refresh Token).
     * @param userUuid UUID del usuario.
     * @param email Correo del usuario.
     * @returns El token de refresco firmado.
     */
    public static generateRefreshToken(userUuid: string, email: string, sessionId: string): string {
        JwtManage.validateSecrets();
        const payload: RefreshTokenPayload = {
            sub: userUuid,
            email: email,
            type: JwtManage.SCOPE_REFRESH_TOKEN,
            sessionId,
        };

        const options: SignOptions = {
            audience: JwtManage.AUDIENCE,
            issuer: JwtManage.ISSUER,
            expiresIn: JwtManage.REFRESH_EXPIRATION as SignOptions['expiresIn'],
            algorithm: 'HS256'
        };

        return jwt.sign(
            payload,
            JwtManage.SECRET_KEY,
            options
        )
    }

    /**
     * Genera un token para validar el email (Email Validation Token).
     * @param userUuid UUID del usuario.
     * @param email Correo del usuario.
     * @param timestamp El tiempo de valides del token.
     * @returns El token para verificar el email firmado.
     */
    public static generateEmailValidationToken(userUuid: string, email: string): string {
        // const secret = JwtManage.SECRET_KEY;
        JwtManage.validateSecrets();
        const payload: RefreshTokenPayload = {
            sub: userUuid,
            email: email,
            type: JwtManage.SCOPE_VALIDATE_EMAIL,
        };

        const options: SignOptions = {
            audience: JwtManage.AUDIENCE,
            issuer: JwtManage.ISSUER,
            expiresIn: JwtManage.EMAIL_VALIDATION_DURATION as SignOptions['expiresIn'],
            algorithm: 'HS256'
        }

        return jwt.sign(
            payload,
            JwtManage.SECRET_KEY,
            options
        )
    }

    /**
     * Genera un token para validar el email (Email Validation Token).
     * @param userUuid UUID del usuario.
     * @param email Correo del usuario.
     * @param timestamp El tiempo de valides del token.
     * @returns El token para verificar el email firmado.
     */
    public static generatePasswordResetToken(uuid: string, email: string): string {
        JwtManage.validateSecrets();
        const payload: RefreshTokenPayload = {
            sub: uuid,
            email: email,
            type: JwtManage.SCOPE_CHANGE_PASSWORD,
        };

        const options: SignOptions = {
            audience: JwtManage.AUDIENCE,
            issuer: JwtManage.ISSUER,
            expiresIn: JwtManage.PASSWORD_RESET_DURATION as SignOptions['expiresIn'],
            algorithm: 'HS256'
        }

        return jwt.sign(
            payload,
            JwtManage.SECRET_KEY,
            options
        )
    }

    /**
     * Verifica y decodifica un token de acceso.
     * @param token Token de acceso a verificar.
     * @returns El payload decodificado si es válido.
     */
    public static verifyAccessToken(token: string): AccessTokenPayload {
        try {
            JwtManage.validateSecrets();
            const decoded = jwt.verify(
                token, 
                JwtManage.SECRET_KEY,
                { audience: JwtManage.AUDIENCE, issuer: JwtManage.ISSUER, algorithms: ['HS256'] }
            ) as AccessTokenPayload;

            if (decoded.type !== JwtManage.SCOPE_ACCESS_TOKEN) {
                throw new Error('Invalid token type.');
            }
            if (typeof decoded.sessionId !== 'string' || !decoded.sessionId) {
                throw new Error('Access token is not associated with a session.');
            }

            return decoded;
        } catch (error) {
            LoggerManage.warn(
                'Access Token verification failed.', 
                { 
                    error: error instanceof Error ? error.message : 'Unknown JWT error' 
                }
            );
            throw error; // El servicio de autenticación manejará esta excepción
        }
    }

    /**
     * Verifica y decodifica un token de refresco.
     * @param token Token de refresco a verificar.
     * @returns El payload decodificado si es válido.
     */
    public static verifyRefreshToken(token: string): SessionRefreshTokenPayload {
        try {
            JwtManage.validateSecrets();
            const decoded = jwt.verify(token, JwtManage.SECRET_KEY,
                { audience: JwtManage.AUDIENCE, issuer: JwtManage.ISSUER, algorithms: ['HS256'] }
            ) as SessionRefreshTokenPayload;
            if (decoded.type !== JwtManage.SCOPE_REFRESH_TOKEN) {
                throw new Error('Invalid token type.');
            }
            if (typeof decoded.sessionId !== 'string' || !decoded.sessionId) {
                throw new Error('Refresh token is not associated with a session.');
            }
            return decoded;
        } catch (error) {
            LoggerManage.warn('Refresh Token verification failed.', { error: error instanceof Error ? error.message : 'Unknown JWT error' });
            throw error;
        }
    }

     /**
     * Verifica y decodifica un token de refresco.
     * @param token Token para validar el correo electronico a verificar.
     * @returns El payload decodificado si es válido.
     */
    public static verifyEmailValidationToken(token: string): RefreshTokenPayload {
        try {
            JwtManage.validateSecrets();
            const decoded = jwt.verify(token, JwtManage.SECRET_KEY,
                { audience: JwtManage.AUDIENCE, issuer: JwtManage.ISSUER, algorithms: ['HS256'] }
            ) as RefreshTokenPayload;
            if (decoded.type !== JwtManage.SCOPE_VALIDATE_EMAIL) {
                throw new Error('Invalid token type.');
            }
            return decoded;
        } catch (error) {
            LoggerManage.warn('Refresh Token verification failed.', { error: error instanceof Error ? error.message : 'Unknown JWT error' });
            throw error;
        }
    }

    /**
     * Verifica y decodifica un token de refresco.
     * @param token Token para cambiar contraseña a verificar.
     * @returns El payload decodificado si es válido.
     */
    public static verifyPasswordResetToken(token: string): RefreshTokenPayload {
        try {
            JwtManage.validateSecrets();
            const decoded = jwt.verify(token, JwtManage.SECRET_KEY,
                { audience: JwtManage.AUDIENCE, issuer: JwtManage.ISSUER, algorithms: ['HS256'] }
            ) as RefreshTokenPayload;
            if (decoded.type !== JwtManage.SCOPE_CHANGE_PASSWORD) {
                throw new Error('Invalid token type.');
            }
            return decoded;
        } catch (error) {
            LoggerManage.warn('Refresh Token verification failed.', { error: error instanceof Error ? error.message : 'Unknown JWT error' });
            throw error;
        }
    }

    public static getExpiredAtFromToken(token: string): Date | undefined {
        const decoded = jwt.decode(token);
        if (!decoded || typeof decoded === 'string') {
            return undefined;
        }
        return decoded.exp ? new Date(decoded.exp * 1000) : undefined;
    }

    public static isTokenExpired(token: string): boolean {
        const expiresAt = JwtManage.getExpiredAtFromToken(token);
        return !expiresAt || expiresAt.getTime() <= Date.now();
    }
}
