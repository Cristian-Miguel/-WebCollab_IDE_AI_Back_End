import { Request, Response, NextFunction } from 'express';
import { JwtManage, AccessTokenPayload } from '../../core/config/jwt_manage'; // Utilizar tu gestor de JWT
// import { LoggerManage } from '../../core/config/logger';
import { AppException } from '../../core/exception/app_exception';
// import { ERROR_MESSAGES } from '../../core/const/error_message';
import { PrismaClient } from '@prisma/client'; // Necesitas el tipo para la inyección de Prisma
import { DatabaseManage } from '../../core/config/database_manage'; // Importar tu gestor de DB
// import { DBException } from '../../core/exception/db_exception';

// Extender el objeto Request de Express para incluir los datos del usuario autenticado
declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload; // Datos del payload del JWT
            prisma?: PrismaClient; // Opcional: inyectar prisma en Request
        }
    }
}

/**
 * @description Middleware para validar el token de acceso (JWT) en el header 'Authorization'.
 * 1. Verifica si existe el token.
 * 2. Valida la firma y expiración del JWT usando JwtManage.
 * 3. Comprueba si el token está en la lista negra (RevokedToken).
 * 4. Adjunta el payload (datos del usuario) al objeto Request (req.user).
 */
export class AuthMiddleware {
    
    private static prisma = DatabaseManage.getInstance();

    public static async validateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        const authHeader = req.headers.authorization;

        // 1. Verificar si existe el token en el header
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Lanza error de no autorizado si no hay token
            return next(new AppException('JWT_INVALID'));
        }

        const token = authHeader.split(' ')[1];

        try {
            // 2. Validar el token de acceso
            const payload: AccessTokenPayload = JwtManage.verifyAccessToken(token);

            // 3. Comprobar si el token está en la lista negra (RevokedToken)
            // Requerimiento: Se guardará el token encriptado en sha256 con salt 
            // Nota: Este paso requiere que el token sea hasheado ANTES de buscarlo en la DB
            // y requiere que la clase BcryptManage incluya un método de hash para tokens.
            
            // **Implementación de la lista negra (Ejemplo):**
            // Se asume que BcryptManage puede hashear el token plano para la búsqueda.
            // const tokenHash = await BcryptManage.hashToken(token);
            // const isBlacklisted = await AuthMiddleware.prisma.revokedToken.findUnique({
            //     where: { tokenHash: tokenHash }
            // });

            // if (isBlacklisted) {
            //     LoggerManage.warn('Blocked token usage attempt.', { token: token.substring(0, 10) + '...' });
            //     return next(new AppException('TOKEN_BLACKLISTED'));
            // }


            // 4. Adjuntar el payload al objeto Request
            req.user = payload;
            
            // Opcional: Adjuntar la instancia de Prisma
            req.prisma = AuthMiddleware.prisma;

            next();
        } catch (error) {
            // Captura errores de JWT (expired, invalid signature, etc.) lanzados por JwtManage
            if (error instanceof AppException) {
                return next(error);
            }
            
            // Si el error es de JWT (JsonWebTokenError, TokenExpiredError), se traduce a un error de la App
            return next(new AppException('JWT_INVALID', error)); 
        }
    }

    /**
     * @description Middleware para verificar si el usuario tiene el rol 'administrador'.
     * Debe ejecutarse DESPUÉS de validateToken.
     * @param req La solicitud Express.
     */
    public static isAdministrator(req: Request, res: Response, next: NextFunction): void {
        if (!req.user || req.user.role !== 'administrador') {
            // Lanza error de acceso denegado (Forbidden)
            return next(new AppException('FORBIDDEN_RESOURCE'));
        }
        next();
    }
    
    /**
     * @description Middleware para verificar si el usuario tiene alguno de los roles requeridos.
     * Debe ejecutarse DESPUÉS de validateToken.
     * @param allowedRoles Array de strings con los roles permitidos (ej: ['administrador', 'soporte']).
     * @returns Función de middleware (req, res, next).
     */
    public static checkRole(allowedRoles: string[]) {
        return (req: Request, res: Response, next: NextFunction): void => {
            
            if (!req.user) {
                return next(new AppException('JWT_MISSING_PAYLOAD'));
            }

            const userRole = req.user.role;

            const roleIsAllowed = allowedRoles.some(role => role === userRole);

            if (roleIsAllowed) {
                next();
            } else {
                return next(new AppException('FORBIDDEN_ROLE_ACCESS'));
            }
        };
    }
}