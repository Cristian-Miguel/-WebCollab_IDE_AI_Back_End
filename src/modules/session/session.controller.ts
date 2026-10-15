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
}
