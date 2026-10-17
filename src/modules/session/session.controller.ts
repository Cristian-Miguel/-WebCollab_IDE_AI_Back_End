import { NextFunction, Request, Response } from 'express';
import { SessionService, CreateSessionDto } from './session.service';
import { SuccessResponse } from '../../core/model/success';
import { SUCCESS_CODES, SUCCESS_MESSAGES } from '../../core/const/sucess_message';
import { AppException } from '../../core/exception/app_exception';

export class SessionController {
    private sessionService: SessionService;

    constructor(sessionService: SessionService = new SessionService()) {
        this.sessionService = sessionService;
    }

    /**
     * Handler para crear una nueva sesión colaborativa (POST /api/v1/sessions).
     * Devuelve el objeto de sesión creado con su UUID y código 201 Created.
     */
    public createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.sub;
            if (!userId) {
                throw new AppException('JWT_INVALID');
            }

            const dto: CreateSessionDto = req.body;
            const session = await this.sessionService.createSession(dto, userId);

            const response = new SuccessResponse(
                session,
                SUCCESS_MESSAGES.SESSION_CREATED,
                SUCCESS_CODES.CREATED
            );

            res.status(response.httpCode).json(response.body);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Handler para unirse a una sesión colaborativa existente (POST /api/v1/sessions/:id/join).
     * Valida el límite de 4 usuarios activos y devuelve 200 OK con la lista de participantes.
     */
    public joinSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.sub;
            if (!userId) {
                throw new AppException('JWT_INVALID');
            }

            const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await this.sessionService.joinSession(sessionId, userId);

            const response = new SuccessResponse(
                result,
                SUCCESS_MESSAGES.SESSION_JOINED,
                SUCCESS_CODES.OK
            );

            res.status(response.httpCode).json(response.body);
        } catch (error) {
            next(error);
        }
    };
}
