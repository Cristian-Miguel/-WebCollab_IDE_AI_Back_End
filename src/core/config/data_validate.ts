import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * @description Middleware para validar los resultados de express-validator.
 *
 * Revisa si hay errores de validación en el objeto Request.
 * Si existen errores, responde con un estado 400 (Bad Request)
 * y un objeto JSON que contiene los detalles de los errores.
 * Si no hay errores, llama a next() para continuar con el siguiente
 * middleware o controlador.
 *
 * Este middleware cumple con el requerimiento de 'data_validate.ts'
 * en la arquitectura de la carpeta core/config. [cite: 31]
 *
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 * @returns {Response | void} Retorna una respuesta 400 si hay errores, o void si llama a next().
 */
export const dataValidate = (req: Request, res: Response, next: NextFunction): Response | void => {
    // Captura los errores de validación que fueron acumulados por los chequeos anteriores
    const errors = validationResult(req);

    // Si el objeto de errores no está vacío, significa que hay fallas de validación
    if (!errors.isEmpty()) {
        // Responde con un estado 400 y el detalle de los errores
        return res.status(400).json({
            // Se usa .array() para obtener un listado limpio de los errores
            errors: errors.array(),
            message: 'Error de validación en los datos proporcionados.',
        });
    }

    // Si no hay errores, la solicitud continúa
    next();
};