import { body } from 'express-validator';
import { dataValidate } from '../../core/config/data_validate';
import { ERROR_MESSAGES } from '../../core/const/error_message';

/**
 * Expresión regular de validación de contraseñas (8 a 16 caracteres).
 * Requiere al menos una minúscula, una mayúscula, un dígito y un carácter especial:
 * ` ~ ! @ # $ % ^ & * ( ) _ - = + [ { ] } \ | ; : ' " < , . > / ?
 */
export const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[`~!@#$%^&*()_\-=+\[{\]}\\|;:'"<,.>\/?])[A-Za-z\d`~!@#$%^&*()_\-=+\[{\]}\\|;:'"<,.>\/?]{8,16}$/;

export const validateLogin = [
    body('email')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isEmail()
        .withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('password')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isLength({ min: 8, max: 16 })
        .withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message),
    dataValidate,
];

export const validateRegister = [
    body('email')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isEmail()
        .withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('password')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    body('password')
        .isLength({ min: 8, max: 16 })
        .withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message),
    body('password')
        .matches(PASSWORD_REGEX)
        .withMessage(ERROR_MESSAGES.INVALID_PASSWORD_FORMAT.message),
    body('fullName')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    body('birthDate')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isISO8601()
        .withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    dataValidate,
];

export const validateRequestPasswordReset = [
    body('email')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isEmail()
        .withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    dataValidate,
];

export const validateChangePassword = [
    body('token')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isJWT()
        .withMessage(ERROR_MESSAGES.JWT_INVALID.message),
    body('password')
        .isLength({ min: 8, max: 16 })
        .withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message),
    body('password')
        .matches(PASSWORD_REGEX)
        .withMessage(ERROR_MESSAGES.INVALID_PASSWORD_FORMAT.message),
    dataValidate,
];

export const validateEmailToken = [
    body('token')
        .exists()
        .withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message)
        .isJWT()
        .withMessage(ERROR_MESSAGES.JWT_INVALID.message),
    dataValidate,
];
