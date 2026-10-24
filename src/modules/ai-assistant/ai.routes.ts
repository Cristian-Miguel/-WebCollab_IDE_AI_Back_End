import { Router } from 'express';
import { AIController } from './ai.controller';
import { validateAISuggest } from './ai.validator';
import { aiRateLimitMiddleware } from './ai.rate-limit.middleware';
import { AuthMiddleware } from '../../feature/auth/auth_middleware';
import { asyncWrapper } from '../../core/config/async_wrapper';

const router = Router();
const aiController = new AIController();

/**
 * @route POST /api/v1/ai/suggest
 * @desc Genera sugerencias de código mediante IA y persiste en SugerenciaIA
 * @access Private (Requiere JWT, protegido con Rate Limiting de máx 5 peticiones/minuto en Redis - HU-27)
 */
router.post(
    '/suggest',
    asyncWrapper(AuthMiddleware.validateToken),
    aiRateLimitMiddleware,
    validateAISuggest,
    asyncWrapper(aiController.suggest)
);

export default router;
