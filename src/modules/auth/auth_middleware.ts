import { NextFunction, Request, Response } from 'express';
import { JwtManage, AccessTokenPayload } from '../../core/config/jwt_manage';
import { RedisPresenceManage } from '../../core/config/redis_manage';
import { AppException } from '../../core/exception/app_exception';
import { ROLES } from '../../core/const/roles';
import { AuthRepository } from './auth_repository';

declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload;
            accessToken?: string;
        }
    }
}

export class AuthMiddleware {
    private static readonly authRepository = new AuthRepository();

    /**
     * HU-25: Valida el Access Token, consulta la lista negra en Redis (`blacklist:token:<jti>`)
     * para rechazar tokens revocados inmediatamente con 401 Unauthorized, y verifica la sesión activa.
     */
    public static async validateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        const [scheme, token, ...extraParts] = req.headers.authorization?.split(' ') ?? [];
        if (scheme !== 'Bearer' || !token || extraParts.length > 0) {
            return next(new AppException('JWT_INVALID'));
        }

        let payload: AccessTokenPayload;
        try {
            payload = JwtManage.verifyAccessToken(token);
        } catch (error) {
            return next(new AppException('JWT_INVALID', error));
        }

        try {
            const jti = payload.jti || JwtManage.extractJtiAndExp(token).jti || payload.sessionId;
            if (jti) {
                const isBlacklisted = await RedisPresenceManage.isTokenBlacklisted(jti);
                if (isBlacklisted) {
                    return next(new AppException('TOKEN_BLACKLISTED'));
                }
            }

            const isActive = await AuthMiddleware.authRepository.hasActiveSession(
                payload.sessionId,
                payload.sub
            );
            if (!isActive) {
                return next(new AppException('SESSION_INACTIVE'));
            }

            req.user = payload;
            req.accessToken = token;
            next();
        } catch (error) {
            next(error);
        }
    }

    public static isAdministrator(req: Request, res: Response, next: NextFunction): void {
        if (!req.user || req.user.role !== ROLES.ADMIN) {
            return next(new AppException('FORBIDDEN_RESOURCE'));
        }
        next();
    }

    public static checkRole(allowedRoles: string[]) {
        return (req: Request, res: Response, next: NextFunction): void => {
            if (!req.user) {
                return next(new AppException('JWT_MISSING_PAYLOAD'));
            }

            const roleIsAllowed = allowedRoles.some((role) => role === req.user?.role);
            if (roleIsAllowed) {
                next();
            } else {
                return next(new AppException('FORBIDDEN_ROLE_ACCESS'));
            }
        };
    }
}

export const authMiddleware = AuthMiddleware.validateToken;
