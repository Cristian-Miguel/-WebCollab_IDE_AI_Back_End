import { Request, Response } from 'express';
import { UserService } from './user_service';
import { SuccessResponse } from '../../core/model/success';
import { SUCCESS_MESSAGES, SUCCESS_CODES } from '../../core/const/sucess_message';
// import { AuthLoginBody, AuthResponse } from './auth_model';
import { AccessTokenPayload } from '../../core/config/jwt_manage';
import { uploadMiddleware } from '../../core/config/multer_manage'; // Importar Multer
import { UserApi } from './user_model';
import { User } from '@prisma/client';
import { Filter, Paginate } from '../../core/config/filter_order_adapter';

/**
 * @description Controlador para manejar las peticiones HTTP relacionadas con la autenticación.
 * Llama a la lógica de negocio en AuthService y maneja la respuesta HTTP.
 */
export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    public create = async (req: Request, res: Response): Promise<void> => {
        await this.userService.create(req.body, req.file, req.headers.authorization?.split(' ')[1] || '');

        const response = new SuccessResponse(
            null,
            SUCCESS_MESSAGES.USER_CREATION_SUCCESS,
            SUCCESS_CODES.CREATED
        );
        res.status(response.httpCode).json(response.body);
    };

    public update = async (req: Request, res: Response): Promise<void> => {
        const accessToken = req.headers.authorization?.split(' ')[1] || '';
        
        await this.userService.update(req.body, accessToken);

        const response = new SuccessResponse(
            null,
            SUCCESS_MESSAGES.USER_CREATION_SUCCESS,
            SUCCESS_CODES.CREATED
        );
        res.status(response.httpCode).json(response.body);
    };

    public getUserByUuid = async (req: Request, res: Response): Promise<void> => {
        const accessToken = req.headers.authorization?.split(' ')[1] || '';
        const { uuid } = req.params;
        const response: SuccessResponse<UserApi> = await this.userService.getUserById(uuid, accessToken);

        res.status(response.httpCode).json(response);
    }

    public deleteUser = async (req: Request, res: Response): Promise<void> => {
        const accessToken = req.headers.authorization?.split(' ')[1] || '';
        const { uuid } = req.params;

        const uuidDelete:string = await this.userService.deleteUser(uuid, accessToken);

        const response:SuccessResponse<string> = new SuccessResponse<string>(
            uuidDelete,
            SUCCESS_MESSAGES.USER_DELETED,
            SUCCESS_CODES.CREATED
        );
        res.status(response.httpCode).json(response);
    }

    public paginateUsers = async (req: Request, res: Response): Promise<void> => {
        const accessToken = req.headers.authorization?.split(' ')[1] || '';

        const paginate: Paginate = req.body;
        const response: SuccessResponse<UserApi[]> = await this.userService.paginateUsers(
            accessToken,
            paginate.page, 
            paginate.limit, 
            paginate.filterBy, 
            paginate.orderBy
        );
        res.status(response.httpCode).json(response);
    }
}