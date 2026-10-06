// src/core/exception/exception_manage.ts

import { Request, Response, NextFunction } from 'express';
import { AppException } from './app_exception';
import { DBException } from './db_exception';
import { ErrorResponse } from '../model/error';
import { ERROR_MESSAGES, ERROR_CODES } from '../const/error_message';
import { LoggerManage } from '../config/logger'; // Asumiendo que existe tu LoggerManage
import { stringify } from 'querystring';

// Definición de las interfaces de error de JWT
interface JwtError extends Error {
    name: 'JsonWebTokenError' | 'TokenExpiredError' | 'NotBeforeError';
    expiredAt?: Date;
}

/**
 * Middleware de manejo de errores global para Express.
 * Debe ser el último middleware agregado a la aplicación (ej. en server.ts).
 * @param err El error capturado.
 * @param req La solicitud Express.
 * @param res La respuesta Express.
 * @param next La función next.
 */
export const exceptionManage = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let response: ErrorResponse;
    let finalHttpCode: number; // Variable para almacenar el código HTTP final
    const isProduction = process.env.NODE_ENV === 'PROD';
    let isDbStack:boolean = err instanceof DBException;
    
    // 1. Manejo de Errores de Prisma (DB)
    if (err instanceof DBException) {
        const dbException:DBException = err;
        response = dbException.toResponse(!isProduction);
        finalHttpCode = response.httpCode;
    }
    // 2. Manejo de Errores Controlados (AppException)
    else if (err instanceof AppException) {
        response = err.toResponse(!isProduction);
        finalHttpCode = response.httpCode;
    }
    // 3. Manejo de Errores de JWT (Jsonwebtoken)
    else if (
        err.name === 'JsonWebTokenError' || 
        err.name === 'TokenExpiredError' || 
        err.name === 'NotBeforeError'
    ) {
        const jwtError: JwtError = err;
        const jwtErrorTemplate = ERROR_MESSAGES.JWT_INVALID;
        
        response = new ErrorResponse(
            jwtErrorTemplate,
            jwtError,
            !isProduction
        );
    } else {
        // Usa el mensaje de error 500 predefinido
        const internalErrorTemplate = ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
        
        // Crear una respuesta de error 500 genérica
        response = new ErrorResponse(
            internalErrorTemplate,
            err instanceof Error ? err : new Error(String(err)),
            !isProduction
        );
        finalHttpCode = internalErrorTemplate.httpCode;

        if (err.name === 'MulterError') {
            finalHttpCode = ERROR_CODES.BAD_REQUEST;
            response.body.code = 'E3001';
            response.body.message = `Fallo en la subida de archivos: ${err.message}`;
        }
    }
    
    response.body.stack_tree = response.body.stack_tree ? sanitizeStack(response.body.stack_tree, isDbStack) : 'No stack trace available.';

    LoggerManage.error(response.body.message, {
        appCode: response.body.code,
        httpCode: response.httpCode,
        path: req.path,
        method: req.method,
        userEmail: (req as any).user?.email || 'N/A', 
        stack: response.body.stack_tree || 'No stack trace available.',
    });

    // Envía la respuesta HTTP estandarizada
    res.status(response.httpCode).json(response.body);
};


// Define las claves sensibles dentro de exception_manage.ts o impórtalas
const sensitiveKeys = ['password', 'rfc', 'curp', 'token', 'fullName']; 

/**
 * Enmascara los valores sensibles directamente en una cadena de texto (ej. stack trace).
 * @param stack El stack trace o el mensaje de error completo.
 * @returns El stack trace modificado.
 */
function sanitizeStack(stack: string, isDbStack: boolean): string {
    if (!stack) return '';
    
    let sanitizedStack;
    const MASK = '***[REDACTED]***';

    const stackArray: string[] = stack.split('\n'); 

    if (isDbStack) {
        let tempStack:string = '';
        let isCode = false
        for (let index = 0; index < stackArray.length; index++) {
            if(stackArray[index] === '') {
                isCode = !isCode;
                tempStack += MASK;
            }
            if(!isCode){
                tempStack += stackArray[index];
            }
        }
        sanitizedStack = tempStack;
    } else {
        sanitizedStack = stack;
    }
    
    for (const key of sensitiveKeys) {
        const regex = new RegExp(`(${key}:\\s*)("[^"]+"|[^,"]+)`, 'gi');
        sanitizedStack = sanitizedStack.replace(regex, `$1"${MASK}"`);
    }

    sanitizedStack = sanitizedStack.replace(/birthDate:\s*"[^"]*"/g, `birthDate: "${MASK}"`);
    
    return sanitizedStack;
}