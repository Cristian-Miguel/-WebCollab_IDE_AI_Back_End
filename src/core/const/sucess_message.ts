// src/core/constant/success_message.ts

/**
 * Códigos HTTP de éxito
 */
export const SUCCESS_CODES = {
    OK: 200,                // Petición exitosa (GET, PUT, PATCH, DELETE Lógico)
    CREATED: 201,           // Recurso creado exitosamente (POST)
    ACCEPTED: 202,          // Petición aceptada para procesamiento
    NO_CONTENT: 204,        // Petición exitosa sin contenido para devolver (DELETE Físico)
} as const; // 'as const' para asegurar que los valores sean constantes

/**
 * Mensajes de Éxito de la Aplicación (Códigos Internos/Claves)
 */
export const SUCCESS_MESSAGES = {
    // Genéricos
    OPERATION_SUCCESSFUL: {
        code: 'S0000',
        message: 'Operación realizada con éxito.',
    },
    DATA_FETCHED: {
        code: 'S0001',
        message: 'Datos obtenidos exitosamente.',
    },

    // Autenticación/Usuarios
    LOGIN_SUCCESS: {
        code: 'S1000',
        message: 'Inicio de sesión exitoso. Bienvenido.',
    },
    REGISTRATION_SUCCESS: {
        code: 'S1001',
        message: 'Registro de usuario exitoso. Se ha enviado un correo para validar su cuenta.',
    },
    LOGOUT_SUCCESS: {
        code: 'S1002',
        message: 'Sesión cerrada exitosamente.',
    },
    PASSWORD_RESET_INITIATED: {
        code: 'S1003',
        message: 'Instrucciones para restablecer la contraseña enviadas a su correo.',
    },
    PASSWORD_CHANGED: {
        code: 'S1004',
        message: 'Contraseña actualizada exitosamente.',
    },
    EMAIL_VALIDATION_SUCCESS: {
        code: 'S1005',
        message: 'Correo electrónico validado con éxito.',
    },
    USER_UPDATED: {
        code: 'S1006',
        message: 'Información de usuario modificada con éxito.',
    },
    USER_DELETED: {
        code: 'S1007',
        message: 'Cuenta de usuario eliminada correctamente.',
    },
    USER_CREATION_SUCCESS: {
        code: 'S1008',
        message: 'Usuario creado exitosamente.',
    },
    USER_PAGINATE_SUCCESS: {
        code: 'S1009',
        message: 'Usuarios paginados exitosamente.'
    },
    USER_GET_SUCCESS: {
        code: 'S1010',
        message: 'Usuarios obtenido exitosamente.'
    },

    // Roles
    ROLE_CREATED: {
        code: 'S2000',
        message: 'Rol creado exitosamente.',
    },
    ROLE_MODIFIED: {
        code: 'S2001',
        message: 'Rol modificado exitosamente.',
    },
    ROLE_DELETED: {
        code: 'S2002',
        message: 'Rol eliminado lógicamente con éxito.',
    },
    
} as const;