import { ERROR_CODES, ERROR_MESSAGES } from '../const/error_message';

/**
 * Interfaz para el cuerpo de la respuesta de error.
 */
export interface ErrorBody {
    code: string;            // Código interno de la aplicación (ej: E1000)
    message: string;         // Mensaje de error al usuario
    stack_tree?: string;     // Stack trace completo (solo si es necesario, ej. en DEV/QA)
}

/**
 * Clase para estandarizar y encapsular los errores de la aplicación y base de datos.
 */
export class ErrorResponse extends Error {
    public readonly httpCode: number;
    public readonly body: ErrorBody;

    /**
     * @param errorMessage El objeto de error predefinido de ERROR_MESSAGES.
     * @param originalError El objeto Error nativo que causó el fallo (opcional).
     * @param includeStack Indica si se debe incluir el stack trace (usar solo en entornos seguros).
     */
    constructor(
        errorMessage: { httpCode: number, appCode: string, message: string },
        originalError?: Error | any,
        includeStack: boolean = (process.env.NODE_ENV !== 'PROD') // Stack por defecto en entornos no productivos
    ) {
        // Llama al constructor de la clase base Error
        super(errorMessage.message);
        this.name = 'ApplicationError';

        // Establece el código HTTP
        this.httpCode = errorMessage.httpCode;

        // Construye el cuerpo de la respuesta de error
        this.body = {
            code: errorMessage.appCode,
            message: errorMessage.message,
            // Agrega el stack trace si se solicita y está disponible en el error original
            ...(includeStack && originalError?.stack && { stack_tree: originalError.stack }),
            // También se puede agregar el mensaje del error original
            ...(!includeStack && originalError?.message && { debug_info: originalError.message }),
        };
        
        // Si no se incluyó stack, pero existe un error original, se usa su mensaje como stack_tree
        if (includeStack && !originalError?.stack && originalError?.message) {
            this.body.stack_tree = originalError.message;
        }

        // Si es un error genérico (500) y el error original existe, sobreescribe el stack
        if (this.httpCode === ERROR_CODES.INTERNAL_SERVER_ERROR && originalError) {
             this.body.stack_tree = (originalError.stack || originalError.message || 'Unknown internal error stack.');
        }

        // Mantiene una pila de llamadas limpia (solo si el runtime lo soporta)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ErrorResponse);
        }
    }
}