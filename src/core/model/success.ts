import { SUCCESS_CODES, SUCCESS_MESSAGES } from '../const/sucess_message';

/**
 * Define la estructura para los metadatos de paginación.
 */
export interface PaginationMetadata {
    rows: number;          // Número de registros en la página actual
    page: number;          // Número de la página actual
    total_data: number;    // Número total de registros disponibles (en todas las páginas)
}

/**
 * Interfaz para el cuerpo de la respuesta exitosa.
 * La propiedad 'data' es genérica para manejar cualquier tipo de contenido.
 */
export interface SuccessBody<T> {
    code: string;            // Código interno del mensaje (ej: S1000)
    message: string;         // Mensaje amigable al usuario
    data: T;                 // Los datos de la respuesta (Objeto, Lista, etc.)
    metadata?: PaginationMetadata; // Metadatos de paginación opcionales
}

/**
 * Clase genérica para estandarizar las respuestas HTTP exitosas.
 * @template T El tipo de dato que se incluye en la respuesta.
 */
export class SuccessResponse<T> {
    public readonly httpCode: number;
    public readonly body: SuccessBody<T>;

    /**
     * @param data Los datos a incluir en la respuesta (el token, lista de usuarios, etc.).
     * @param successMessage El objeto de mensaje predefinido de SUCCESS_MESSAGES.
     * @param httpCode El código HTTP a usar (por defecto 200).
     * @param metadata Los datos de paginación (opcional).
     */
    constructor(
        data: T,
        successMessage: { code: string; message: string },
        httpCode: number = SUCCESS_CODES.OK,
        metadata?: PaginationMetadata
    ) {
        this.httpCode = httpCode;
        this.body = {
            code: successMessage.code,
            message: successMessage.message,
            data: data,
            // Agrega metadatos solo si existen
            ...(metadata && { metadata: metadata }),
        };
    }
}