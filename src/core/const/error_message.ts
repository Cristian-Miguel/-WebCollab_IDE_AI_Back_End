// src/core/constant/error_message.ts

/**
 * Códigos HTTP de error
 */
export const ERROR_CODES = {
    BAD_REQUEST: 400,           // Errores de validación o sintaxis
    UNAUTHORIZED: 401,          // Autenticación fallida (Credenciales o Token)
    FORBIDDEN: 403,             // Acceso denegado (Permisos/Roles insuficientes)
    NOT_FOUND: 404,             // Recurso no encontrado
    INTERNAL_SERVER_ERROR: 500, // Error interno de la aplicación
    SERVICE_UNAVAILABLE: 503,   // Servicio temporalmente no disponible
} as const;

/**
 * Mensajes de Error de la Aplicación (Códigos Internos/Claves)
 */
export const ERROR_MESSAGES = {
    // Errores Genéricos/Base de Datos (E0xxx)
    INTERNAL_SERVER_ERROR: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E0000',
        message: 'Ocurrió un error interno en el servidor.',
    },
    DB_OPERATION_FAILED: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E0001',
        message: 'Fallo al interactuar con la base de datos.',
    },
    DB_UNIQUE_CONSTRAINT: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E0002',
        message: 'El registro ya existe (violación de unicidad).',
    },
    NOT_FOUND: {
        httpCode: ERROR_CODES.NOT_FOUND,
        appCode: 'E0003',
        message: 'El recurso solicitado no fue encontrado.',
    },
    DB_DATA_INVALID_FORMAT: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E0004',
        message: 'Los datos proporcionados no cuentan con el formato necesarios para manipular la base de datos.',
    },

    // Errores de Autenticación (E1xxx)
    INVALID_CREDENTIALS: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E1000',
        message: 'Correo o contraseña incorrectos.',
    },
    USER_BLOCKED: {
        httpCode: ERROR_CODES.FORBIDDEN,
        appCode: 'E1001',
        message: 'Acceso bloqueado. Intente de nuevo en 15 minutos.',
    },
    MAX_LOGIN_ATTEMPTS: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E1002',
        message: 'Ha excedido el límite de intentos de sesión. Su cuenta ha sido bloqueada temporalmente.',
    },
    EMAIL_NOT_VALIDATED: {
        httpCode: ERROR_CODES.FORBIDDEN,
        appCode: 'E1003',
        message: 'Su correo aún no ha sido validado. Por favor, revise su bandeja de entrada.',
    },
    JWT_INVALID: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E1004',
        message: 'Token de autenticación inválido o expirado.',
    },
    JWT_REFRESH_EXPIRED: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E1005',
        message: 'La sesión ha caducado. Por favor, inicie sesión nuevamente.',
    },
    TOKEN_BLACKLISTED: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E1006',
        message: 'El token utilizado ya no es válido (sesión cerrada).',
    },
    JWT_MISSING_PAYLOAD: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E1007',
        message: 'El token no contiene la información necesaria.',
    },
    
    // Errores de Permisos (E2xxx)
    FORBIDDEN_RESOURCE: {
        httpCode: ERROR_CODES.FORBIDDEN,
        appCode: 'E2000',
        message: 'No tiene permisos para realizar esta acción.',
    },
    FORBIDDEN_ROLE_ACCESS: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E2001',
        message: 'El rol especificado no es válido o no existe.',
    },
    TOKEN_REQUIRED: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E2002',
        message: 'El token es obligatorio para esta operación.',
    },
    TOKEN_ALREADY_USED: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E2003',
        message: 'El token ya ha sido utilizado.',
    },
    EMAIL_ALREADY_VALIDATED: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E2004',
        message: 'El correo ya ha sido validado previamente.',
    },
    
    // Errores de Validación - Usados por express-validator/data_validate.ts
    VALIDATION_FAILED: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3000',
        message: 'Error de validación en los datos proporcionados.',
    },
    REQUIRED_FIELD: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3001',
        message: 'El campo es obligatorio y no puede estar vacío.',
    },
    INVALID_FORMAT: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3002',
        message: 'El formato del dato proporcionado es incorrecto.',
    },
    INVALID_PASSWORD_LENGTH: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3003',
        message: 'La contraseña debe tener entre 8 y 16 caracteres.',
    },
    INVALID_PASSWORD_FORMAT: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3004',
        message: 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial.',
    },
    ACCOUNT_LOCKED: {
        httpCode: ERROR_CODES.UNAUTHORIZED,
        appCode: 'E3005',
        message: 'La cuenta está bloqueada debido a múltiples intentos fallidos de inicio de sesión.',
    },
    USER_NOT_FOUND: {
        httpCode: ERROR_CODES.NOT_FOUND,
        appCode: 'E3006',
        message: 'El usuario especificado no existe.',
    },
    SESSION_INACTIVE: {
        httpCode: ERROR_CODES.FORBIDDEN,
        appCode: 'E3007',
        message: 'La sesión del usuario está inactiva. Por favor, inicie sesión nuevamente.',
    },
    USER_ALREADY_EXISTS: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3008',
        message: 'El usuario con los datos proporcionados ya existe.',
    },
    ADDRESS_CREATION_FAILED: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E3009',
        message: 'No se pudo crear la dirección proporcionada.',
    },
    ADDRESS_UPDATE_FAILED: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E3010',
        message: 'No se pudo actualizar la dirección proporcionada.',
    },
    PASSWORD_REQUIRED: {
        httpCode: ERROR_CODES.BAD_REQUEST,
        appCode: 'E3011',
        message: 'La contraseña es obligatoria para el registro.',
    },
    ADDRESS_NOT_FOUND: {
        httpCode: ERROR_CODES.NOT_FOUND,
        appCode: 'E3012',
        message: 'La dirección especificada no existe.',
    },
    ROLE_NOT_FOUND: {
        httpCode: ERROR_CODES.NOT_FOUND,
        appCode: 'E3013',
        message: 'El rol especificado no existe.',
    },
    FILTER_FIELD_ERROR: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E3014',
        message: 'El campo no existe o no se puede realizar un filtro.',
    },
    FILTER_OPERATOR_ERROR: {
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E3015',
        message: 'El operador no existe o no se puede realizar un filtro.',
    },
    ORDER_FIELD_ERROR:{
        httpCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        appCode: 'E3016',
        message: 'El campo no existe o no se puede realizar un filtro.',
    },
    
} as const;