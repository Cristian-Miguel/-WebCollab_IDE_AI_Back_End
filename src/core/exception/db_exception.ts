// src/core/exception/db_exception.ts

import { Prisma } from '@prisma/client';
import { ERROR_MESSAGES } from '../const/error_message';
import { ErrorResponse } from '../model/error';
import { IErrorMessage } from './app_exception';

/**
 * Clase para manejar y traducir errores conocidos de Prisma (DB).
 * Se utiliza para mapear códigos de error internos de la DB a errores de la aplicación.
 */
export class DBException extends Error {
    public readonly errorBody: IErrorMessage;
    public readonly originalError?: Error | any;
    
    /**
     * @param prismaError El error original de Prisma (ej. una instancia de PrismaClientKnownRequestError).
     * @param context Mensaje adicional para dar contexto al error.
     */
    constructor(
        prismaError: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError | Prisma.PrismaClientInitializationError
        | Prisma.PrismaClientRustPanicError | Prisma.PrismaClientUnknownRequestError,
        context?: string,
        customMessage?: string
    ) {
        let mappedError: IErrorMessage;
        const contextInfo = context ? ` Contexto: ${context}` : '';

        if (prismaError instanceof Prisma.PrismaClientKnownRequestError) {
            const prismaCode = prismaError.code;

            switch (prismaError.code) {
                case 'P2000':
                    mappedError = ERROR_MESSAGES['DB_DATA_INVALID_FORMAT'];
                    customMessage = `[DB ${prismaCode}] Error de truncamiento de datos: El valor excede la longitud máxima permitida para una columna. Revise los datos de entrada. ${contextInfo}`;break;
                case 'P2001':
                    mappedError = ERROR_MESSAGES['NOT_FOUND'];
                    customMessage = `[DB ${prismaCode}] Registro no encontrado para 'where' específico. La búsqueda no arrojó un resultado esperado. ${contextInfo}`;
                    break;
                case 'P2002':
                    const fields = (prismaError.meta as { target?: string[] })?.target?.join(', ') || 'campo(s) único(s)';
                    mappedError = ERROR_MESSAGES['DB_UNIQUE_CONSTRAINT'];
                    customMessage = `El registro ya existe para: ${fields}. ${context || ''}`;
                    customMessage = `[DB ${prismaCode}] El registro ya existe. Violación de restricción única en el campo(s): ${fields}. ${contextInfo}`;
                    break;
                case 'P2003':
                    // Violación de clave foránea
                    const fieldP2003 = (prismaError.meta as { field_name?: string })?.field_name || 'una clave foránea';
                    mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
                    customMessage = `[DB ${prismaCode}] Violación de Clave Foránea (Foreign Key): No se pudo vincular a un registro que no existe, o se intentó eliminar un registro padre. Campo afectado: ${fieldP2003}. ${contextInfo}`;
                    break;
                case 'P2004':
                    mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
                    customMessage = `[DB ${prismaCode}] Falla en una restricción interna de la base de datos (Ej: CHECK constraint). Revise la lógica de la DB. ${contextInfo}`;
                    break;
                case 'P2010':
                    mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
                    customMessage = `[DB ${prismaCode}] Error de consulta SQL. La consulta generada por Prisma es inválida para la base de datos subyacente. ${contextInfo}`;
                    break;
                case 'P2014':
                    mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
                    customMessage = `[DB ${prismaCode}] Violación de relación de modelos. La operación de conexión/desconexión intentada no es válida según el esquema de Prisma. ${contextInfo}`;
                    break;
                case 'P2025':
                    mappedError = ERROR_MESSAGES['NOT_FOUND'];
                    customMessage = `[DB ${prismaCode}] Registro requerido no encontrado para la operación. El 'update', 'delete' o 'connect' falló. ${contextInfo}`;
                    break;
                case 'P2034':
                    mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
                    customMessage = `[DB ${prismaCode}] Error de transacción (Deadlock/Rollback). La consulta falló debido a un bloqueo o condición de carrera en la base de datos. Se recomienda reintentar la operación. ${contextInfo}`;
                    break;
                default:
                    mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
                    customMessage = `[DB ${prismaCode}] Error de DB Conocido no mapeado. ${contextInfo}`;
                    break;
            }
        } else if(prismaError instanceof Prisma.PrismaClientValidationError) {
            mappedError = ERROR_MESSAGES['DB_DATA_INVALID_FORMAT'];
            customMessage = `[Prisma Validation] Error de argumento en la consulta de Prisma. Revise los tipos y campos de entrada en el código de aplicación.`;
        } else {
            mappedError = ERROR_MESSAGES['DB_OPERATION_FAILED'];
            customMessage = `[DB Error Desconocido] Error no identificado en la base de datos. Tipo de error: ${prismaError.name}. ${contextInfo}`;
        }

        super(customMessage || mappedError.message);

        this.errorBody = {
            ...mappedError,
            message: customMessage || mappedError.message,
        };
    }

    /**
     * Convierte la excepción en un modelo de respuesta estandarizado para HTTP.
     * @param includeStack Si se debe incluir el stack trace.
     * @returns Una instancia de ErrorResponse.
     */
    public toResponse(includeStack: boolean = (process.env.NODE_ENV !== 'PROD')): ErrorResponse {
        return new ErrorResponse(
            this.errorBody,
            this.originalError || this, // Pasa el error original o esta propia instancia
            includeStack
        );
    }
}