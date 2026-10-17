import { body } from 'express-validator';
import { dataValidate } from '../../core/config/data_validate';

export const validateAISuggest = [
    body('contextoCodigo')
        .isString()
        .withMessage('El contexto de código debe ser una cadena de texto.')
        .notEmpty()
        .withMessage('El contexto de código es requerido.'),
    body('lenguaje')
        .notEmpty()
        .withMessage('El lenguaje es requerido.')
        .isIn(['html', 'css', 'javascript'])
        .withMessage('El lenguaje debe ser html, css o javascript.'),
    body('promptUsuario')
        .optional()
        .isString()
        .withMessage('El prompt del usuario debe ser una cadena de texto.')
        .trim()
        .isLength({ max: 2000 })
        .withMessage('El prompt del usuario no puede exceder los 2000 caracteres.'),
    body('sesionId')
        .optional()
        .isString()
        .withMessage('El ID de la sesión debe ser una cadena de texto.')
        .trim(),
    dataValidate,
];
