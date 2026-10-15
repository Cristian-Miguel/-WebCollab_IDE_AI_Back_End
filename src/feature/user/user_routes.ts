import { Router } from 'express';
import { body, param } from 'express-validator';
import { UserController } from './user_controller';
import { dataValidate } from '../../core/config/data_validate';
import { AuthMiddleware } from '../auth/auth_middleware';
import { ERROR_MESSAGES } from '../../core/const/error_message';
import { ROLES } from '../../core/const/roles';
import { asyncWrapper } from '../../core/config/async_wrapper';

const router = Router();
const userController: UserController = new UserController();

router.post('', [
    AuthMiddleware.validateToken,
    AuthMiddleware.checkRole([ROLES.ADMIN]),
    body('email').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isEmail().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('password').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isLength({ min: 8, max: 16 }).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_FORMAT.message),
    body('fullName').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    dataValidate,
    asyncWrapper(userController.create)
]);

router.put('', [
    AuthMiddleware.validateToken,
    AuthMiddleware.checkRole([ROLES.ADMIN, ROLES.CUSTOMER, ROLES.SUPPORT]),
    body('email').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isEmail().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('password').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isLength({ min: 8, max: 16 }).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_LENGTH.message)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/).withMessage(ERROR_MESSAGES.INVALID_PASSWORD_FORMAT.message),
    body('fullName').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    dataValidate,
    asyncWrapper(userController.update)
]);

router.delete('/:uuid', [
    AuthMiddleware.validateToken,
    AuthMiddleware.checkRole([ROLES.ADMIN, ROLES.CUSTOMER]),
    param('uuid').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isUUID().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    dataValidate,
    asyncWrapper(userController.deleteUser)
]);

router.get('/:uuid', [
    AuthMiddleware.validateToken,
    AuthMiddleware.checkRole([ROLES.ADMIN, ROLES.CUSTOMER, ROLES.SUPPORT]),
    param('uuid').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isUUID().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    dataValidate,
    asyncWrapper(userController.getUserByUuid)
]);

router.post('/paginate', [
    AuthMiddleware.validateToken,
    AuthMiddleware.checkRole([ROLES.ADMIN, ROLES.SUPPORT]),
    body('filterBy').optional({ checkFalsy: true }).isArray().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('filterBy.*.value').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message),
    body('filterBy.*.field').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isString().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('filterBy.*.operator').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isString().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    
    body('orderBy').optional({ checkFalsy: true }).isObject().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('orderBy.field').optional({ checkFalsy: true }).exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isString().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('orderBy.operator').optional({ checkFalsy: true }).exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isString().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),

    body('page').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isNumeric().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),
    body('limit').exists().withMessage(ERROR_MESSAGES.REQUIRED_FIELD.message).isNumeric().withMessage(ERROR_MESSAGES.INVALID_FORMAT.message),

    dataValidate,
    asyncWrapper(userController.paginateUsers)
]);

export default router