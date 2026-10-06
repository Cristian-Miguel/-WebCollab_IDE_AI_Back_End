import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

// La función wrapper que maneja la lógica de try/catch
export const asyncWrapper = (fn: AsyncFunction) => 
    (req: Request, res: Response, next: NextFunction) => {
        // Ejecuta la función del controlador y si falla, pasa el error a next()
        Promise.resolve(fn(req, res, next)).catch(next);
    };