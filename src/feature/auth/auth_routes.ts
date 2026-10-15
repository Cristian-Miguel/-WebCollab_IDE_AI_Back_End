import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from './auth_controller';
import { dataValidate } from '../../core/config/data_validate';
import { AuthMiddleware } from './auth_middleware';
import { ERROR_MESSAGES } from '../../core/const/error_message';
import { asyncWrapper } from '../../core/config/async_wrapper';

const router = Router();

// 1. INICIO DE SESIÓN (Login)
// Requerimiento: Correo válido y contraseña de 8 a 16 caracteres.
router.post('/login', [
    body('email').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isEmail().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('password').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isLength({ min: 8, max: 16 }).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message),
    dataValidate, 
    asyncWrapper(authController.login)
]);

// 2. REGISTRO DE USUARIOS (Register)
// Requerimiento: Validación exhaustiva de todos los campos.
router.post('/register', [
    body('email').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isEmail().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('password').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    body('password').isLength({ min: 8, max: 16 }).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message),
    body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-_])[A-Za-z\d@$!%*?&-_]{8,16}$/).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_FORMAT.message),
    body('fullName').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    body('birthDate').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isISO8601().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    dataValidate,
    asyncWrapper(authController.register)
]);

// 3. CERRAR SESIÓN (Logout)
// Requerimiento: El usuario manda el token para guardar la fecha y hora de salida.
router.post('/logout', [
    AuthMiddleware.validateToken,
    asyncWrapper(authController.logout)
]);

// 4. REFRESH TOKEN
// Requerimiento: Generar un nuevo token base con el refresh token.
router.post(['/refresh-token', '/refresh'], [
    // body('refreshToken').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isJWT().withMessage(ERROR_MESSAGES.JWT_INVALID.message),
    // dataValidate,
    asyncWrapper(authController.refreshToken)
]);

// 5. SOLICITAR RESTABLECIMIENTO (Request Password Reset)
// Requerimiento: El usuario manda su correo. Si existe, se le manda el email.
router.post('/password/request-reset', [
    body('email').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isEmail().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    dataValidate,
    asyncWrapper(authController.requestPasswordReset)
]);

// 6. CAMBIAR CONTRASEÑA (Change Password)
// Requerimiento: El usuario manda la nueva contraseña válida junto con el token.
router.post('/password/change', [
    body('token').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isJWT().withMessage(ERROR_MESSAGES.JWT_INVALID.message),
    
    // Nueva contraseña: Reutiliza la validación estricta de la contraseña del registro.
    body('password').isLength({ min: 8, max: 16 }).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message),
    body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-_])[A-Za-z\d@$!%*?&-_]{8,16}$/).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_FORMAT.message),

    dataValidate,
    asyncWrapper(authController.changePassword)
]);

// =================================================================================
// Rutas de VALIDACIÓN DE CORREO
// =================================================================================

// 7. VALIDAR CORREO ELECTRÓNICO
// Requerimiento: El usuario entra al link que envía el token (aquí se recibe el token por POST).
router.post('/email/validate', [
    body('token').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isJWT().withMessage(ERROR_MESSAGES.JWT_INVALID.message),
    dataValidate,
    asyncWrapper(authController.validateEmail)
]);

// 7. VALIDAR CORREO ELECTRÓNICO
// Requerimiento: El usuario entra al link que envía el token (aquí se recibe el token por POST).
router.post('/email/validate/request', [
    AuthMiddleware.validateToken,
    asyncWrapper(authController.resendValidateEmail)
]);

export default router