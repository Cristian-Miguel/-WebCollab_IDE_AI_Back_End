import { Router } from 'express';
import { authController } from './auth_controller';
import { AuthMiddleware } from './auth_middleware';
import { asyncWrapper } from '../../core/config/async_wrapper';
import {
    validateLogin,
    validateRegister,
    validateRequestPasswordReset,
    validateChangePassword,
    validateEmailToken,
} from './auth.validator';

const router = Router();

// 1. INICIO DE SESIÓN (Login)
// Requerimiento: Correo válido y contraseña de 8 a 16 caracteres.
router.post('/login', [
    ...validateLogin,
    asyncWrapper(authController.login)
]);

// 2. REGISTRO DE USUARIOS (Register)
// Requerimiento: Validación exhaustiva de todos los campos.
router.post('/register', [
    ...validateRegister,
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
    asyncWrapper(authController.refreshToken)
]);

// 5. SOLICITAR RESTABLECIMIENTO (Request Password Reset)
// Requerimiento: El usuario manda su correo. Si existe, se le manda el email.
router.post('/password/request-reset', [
    ...validateRequestPasswordReset,
    asyncWrapper(authController.requestPasswordReset)
]);

// 6. CAMBIAR CONTRASEÑA (Change Password)
// Requerimiento: El usuario manda la nueva contraseña válida junto con el token.
router.post('/password/change', [
    ...validateChangePassword,
    asyncWrapper(authController.changePassword)
]);

// =================================================================================
// Rutas de VALIDACIÓN DE CORREO
// =================================================================================

// 7. VALIDAR CORREO ELECTRÓNICO
// Requerimiento: El usuario entra al link que envía el token (aquí se recibe el token por POST).
router.post('/email/validate', [
    ...validateEmailToken,
    asyncWrapper(authController.validateEmail)
]);

// 7. VALIDAR CORREO ELECTRÓNICO
// Requerimiento: El usuario entra al link que envía el token (aquí se recibe el token por POST).
router.post('/email/validate/request', [
    AuthMiddleware.validateToken,
    asyncWrapper(authController.resendValidateEmail)
]);

export default router
