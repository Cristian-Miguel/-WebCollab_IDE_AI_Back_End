import { body, param } from 'express-validator';
import { dataValidate } from '../../core/config/data_validate';

export const validateCreateSession = [
    body('nombre')
        .notEmpty()
        .withMessage('El nombre de la sesión es requerido.')
        .isString()
        .withMessage('El nombre debe ser una cadena de texto.')
        .trim()
        .isLength({ min: 3, max: 255 })
        .withMessage('El nombre debe tener entre 3 y 255 caracteres.'),
    body('descripcion')
        .optional()
        .isString()
        .withMessage('La descripción debe ser una cadena de texto.')
        .trim()
        .isLength({ max: 1000 })
        .withMessage('La descripción no puede exceder los 1000 caracteres.'),
    dataValidate,
];

export const validateJoinSession = [
    param('id')
        .notEmpty()
        .withMessage('El ID de la sesión es requerido.')
        .isString()
        .withMessage('El ID de la sesión debe ser válido.')
        .trim(),
    dataValidate,
];
