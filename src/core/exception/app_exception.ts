import { ErrorResponse } from '../model/error';
import { ERROR_MESSAGES } from '../const/error_message';

/**
 * Define la estructura de un mensaje de error predefinido para ser tipado.
 */
export interface IErrorMessage {
    httpCode: number;
    appCode: string;
    message: string;
}

/**
 * Clase base para todas las excepciones controladas de la lógica de la aplicación.
 * Permite lanzar errores que ya tienen un código HTTP y un mensaje de aplicación definidos.
 */
export class AppException extends Error {
    public readonly errorBody: IErrorMessage;
    public readonly originalError?: Error | any;

    /**
     * @param errorMessageKey Clave del mensaje en ERROR_MESSAGES (ej. 'INVALID_CREDENTIALS').
     * @param originalError El error nativo que causó esta excepción (opcional).
     * @param customMessage Un mensaje opcional que sobrescribe el mensaje predefinido.
     */
    constructor(
        errorMessageKey: keyof typeof ERROR_MESSAGES,
        originalError?: Error | any,
        customMessage?: string
    ) {
        const errorTemplate = ERROR_MESSAGES[errorMessageKey];
        
        // Llama al constructor de Error con el mensaje predefinido o personalizado
        super(customMessage || errorTemplate.message);
        
        this.name = 'AppException';
        
        // Guarda el cuerpo del error, permitiendo sobrescribir el mensaje
        this.errorBody = {
            ...errorTemplate,
            message: customMessage || errorTemplate.message,
        };

        this.originalError = originalError;

        // Mantiene una pila de llamadas limpia
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppException);
        }
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