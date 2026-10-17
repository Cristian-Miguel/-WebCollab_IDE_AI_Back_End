import { NextFunction, Request, Response } from 'express';
import { AIService, AISuggestRequestDto } from './ai.service';
import { SuccessResponse } from '../../core/model/success';
import { SUCCESS_CODES, SUCCESS_MESSAGES } from '../../core/const/sucess_message';
import { AppException } from '../../core/exception/app_exception';

export class AIController {
    private aiService: AIService;

    constructor(aiService: AIService = new AIService()) {
        this.aiService = aiService;
    }

    /**
     * Handler para solicitar sugerencias de código a la IA (POST /api/v1/ai/suggest).
     * Persiste la interacción en SugerenciaIA y devuelve 200 OK.
     */
    public suggest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.sub;
            if (!userId) {
                throw new AppException('JWT_INVALID');
            }

            const dto: AISuggestRequestDto = req.body;
            const suggestion = await this.aiService.generateSuggestion(dto, userId);

            const response = new SuccessResponse(
                suggestion,
                SUCCESS_MESSAGES.AI_SUGGESTION_GENERATED,
                SUCCESS_CODES.OK
            );

            res.status(response.httpCode).json(response.body);
        } catch (error) {
            next(error);
        }
    };
}
