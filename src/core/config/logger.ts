import { createLogger, format, transports, Logger } from 'winston';
import * as path from 'path';

// Extrae los niveles de log de las variables de entorno, por defecto a 'info'
const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'PROD';
const errorLogPath = path.join(process.cwd(), 'logs', 'error.log');
const exceptionLogPath = path.join(process.cwd(), 'logs', 'exception.log');
const combinedLogPath = path.join(process.cwd(), 'logs', 'combined.log');

// src/core/config/log_sanitizer.ts (Crea este nuevo archivo)

const sensitiveKeys = ['password', 'refreshToken', 'accessToken'];
const MASK = '[REDACTED]';

/**
 * Filtra las claves sensibles de un objeto de metadatos.
 * @param metadata El objeto de metadatos del log.
 * @returns El objeto de metadatos sin claves sensibles.
 */
export function sanitizeLogMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') {
        return metadata;
    }

    const sanitized = { ...metadata };

    for (const key of sensitiveKeys) {
        if (sanitized[key]) {
            sanitized[key] = MASK;
        }
    }
    
    return sanitized;
}

/**
 * Formato para filtrar metadatos sensibles
 */
const sensitiveFilter = format((info, opts) => {
    // Si hay metadatos (el cuarto argumento de LoggerManage.info('msg', { metadata }))
    if (info.metadata && typeof info.metadata === 'object') {
        info.metadata = sanitizeLogMetadata(info.metadata);
    }
    // Para el formato de desarrollo (printf), el 'message' ya puede contener datos sensibles
    // Esto lo filtra antes de pasar a JSON o printf
    if (info.message && typeof info.message === 'object') {
        info.message = sanitizeLogMetadata(info.message);
    }
    return info;
});


/**
 * Formato de log para entorno de desarrollo (más legible en consola).
 * Muestra el nivel, la marca de tiempo y el mensaje en color.
 */
const developmentFormat = format.combine(
    sensitiveFilter(),
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ level, message, timestamp, ...metadata }) => {
        // Asegura que los metadatos se muestren si existen
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

/**
 * Formato de log para entorno de producción (JSON estructurado).
 * Ideal para sistemas de monitoreo como ELK, Splunk o CloudWatch.
 */
const productionFormat = format.combine(
    sensitiveFilter(),
    format.timestamp(),
    format.json() 
);

/**
 * Crea y exporta el logger principal de Winston.
 * @returns Instancia de Winston Logger configurada.
 */
const LoggerManage: Logger = createLogger({
    level: logLevel, // Nivel de log tomado de .env
    
    // Formato basado en el entorno
    format: isProduction ? productionFormat : developmentFormat,
    
    // Transportes (dónde se enviarán los logs)
    transports: [
        new transports.Console({ 
            format: isProduction ? productionFormat : developmentFormat 
        }),
        new transports.File({ 
            filename: errorLogPath, 
            level: 'error',
            maxsize: 512000,
            maxFiles:2,
            format:  isProduction ? productionFormat : developmentFormat,
        }),
        new transports.File({ 
            filename: combinedLogPath,
            maxsize: 512000,
            maxFiles: 5,
            format:  isProduction ? productionFormat : developmentFormat,
        }),
    ],
    
    // Manejar excepciones no capturadas
    exceptionHandlers: [
        new transports.Console({ format: developmentFormat }),
        new transports.File({ 
            filename: exceptionLogPath,
            maxsize: 512000,
            maxFiles: 5,
            format:  isProduction ? productionFormat : developmentFormat,
        }),
    ],
});

export { LoggerManage };
