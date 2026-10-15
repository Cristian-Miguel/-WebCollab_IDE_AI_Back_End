import { Router } from 'express';
import { SessionController } from './session.controller';
import { validateCreateSession } from './session.validator';
import { AuthMiddleware } from '../../feature/auth/auth_middleware';
import { asyncWrapper } from '../../core/config/async_wrapper';

const router = Router();
const sessionController: SessionController = new SessionController();

/**
 * @route POST /api/v1/sessions
 * @desc Crea una nueva sesión colaborativa
 * @access Private (Requiere JWT)
 */
router.post(
    '/',
    asyncWrapper(AuthMiddleware.validateToken),
    validateCreateSession,
    asyncWrapper(sessionController.createSession)
);

export default router;
