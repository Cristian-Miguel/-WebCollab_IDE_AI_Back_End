// src/feature/auth/auth_service.ts

import { BcryptManage } from '../../core/config/bcript_manage';
import { JwtManage, AccessTokenPayload, RefreshTokenPayload } from '../../core/config/jwt_manage';
import { LoggerManage } from '../../core/config/logger';
import { AppException } from '../../core/exception/app_exception';
import { ROLES } from '../../core/const/roles';
import { UserRepository } from '../user/user_repository';
import { UserApi, UserDomain, toUserDomain, userToUserDomain, toUserApi } from '../user/user_model';
import { RoleRepository } from '../role/role_repository';
import { roleToRoleDomain } from '../role/role_model';
import { sendEmail } from '../../core/config/mail_sender';
import { uploadSingleImage } from '../../core/config/multer_manage';
import { PrismaClient, Role, ROLE_TYPE, User } from '@prisma/client';
import { DatabaseManage } from '../../core/config/database_manage';
import { SuccessResponse } from '../../core/model/success';
import { FilterOrderAdapter, Filter, Order } from '../../core/config/filter_order_adapter';
import { SUCCESS_CODES, SUCCESS_MESSAGES } from '../../core/const/sucess_message';

/**
 * @description Servicio que contiene la lógica de negocio para la autenticación (Login, Registro, Tokens, etc.).
 */
export class UserService {
    private userRepository: UserRepository;
    private roleRepository: RoleRepository;
    private prisma: PrismaClient;

    constructor() {
        this.userRepository = new UserRepository();
        this.roleRepository = new RoleRepository();
        this.prisma = DatabaseManage.getInstance();
    }
    
    /**
     * @description Proceso de inicio de sesión completo.
     */
    public async update(userData: UserApi, token: string): Promise<UserApi> {
        const { email } = userData;
        const user = await this.userRepository.findUserByEmail(email);
        const payload = JwtManage.verifyAccessToken(token) as AccessTokenPayload;

        if (!user || !user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }
        
        if (user.isAccountLocked && user.lockUntil && user.lockUntil > new Date()) {
            throw new AppException('ACCOUNT_LOCKED'); 
        }

        if (!user.isEmailVerified) {
             throw new AppException('EMAIL_NOT_VALIDATED');
        }

        if(user.id != token && user.role.name != ROLE_TYPE.ADMINISTRATOR) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            let userDomain: UserDomain = toUserDomain(userData);

            const userDB: User = await this.userRepository.updateUser(userDomain, tx);
            const roleDB: Role = await this.roleRepository.getRoleByName(userDomain.role.name) as Role;

            userDomain = userToUserDomain(userDB, roleDB);
            userDomain.roleId = roleDB.id;
            userDomain.role = roleToRoleDomain(roleDB);
            userDomain.password = '';

            return toUserApi(userDomain, userDomain.role);
        });

        LoggerManage.info('User logged in successfully.', { email });

        return result;
    }

    /**
     * @description Lógica de registro.
     * @param userData Datos de registro.
     * @param profileImageFile Archivo de imagen subido por Multer.
     */
    public async create(userData: UserApi, profileImageFile: Express.Multer.File | undefined, token: string): Promise<void> {
        const { password, ...rest } = userData;
        const payload = JwtManage.verifyAccessToken(token) as AccessTokenPayload;

        let profileImageUrl: string | undefined;
        if (profileImageFile) {
            profileImageUrl = await uploadSingleImage(profileImageFile.fieldname);
        }

        if (payload.role !== ROLE_TYPE.ADMINISTRATOR && payload.role !== ROLE_TYPE.SUPPORT) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        if (payload.role == ROLE_TYPE.SUPPORT && userData.role.name.toUpperCase() == ROLE_TYPE.ADMINISTRATOR) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        if (!password) {
            throw new AppException('PASSWORD_REQUIRED', null, 'La contraseña es obligatoria para el registro.');
        }

        const passwordHash = await BcryptManage.hashPassword(password!);
        const userDomain: UserDomain = toUserDomain({ ...rest, password: passwordHash });
        
        const result: UserApi = await this.prisma.$transaction(async (tx) => {
            const defaultRole = await this.roleRepository.getRoleByName(userDomain.role.name);
            if (!defaultRole) {
                throw new AppException('FORBIDDEN_ROLE_ACCESS');
            }

            userDomain.roleId = defaultRole.id;
            userDomain.profileImageUrl = profileImageUrl || '';

            const role: Role = await this.roleRepository.getRoleByName(userDomain.role.name) as Role;
            userDomain.roleId = defaultRole.id;
            const user: User = await this.userRepository.createUser(userDomain, tx);
            
            userDomain.role = roleToRoleDomain(role);
            userDomain.id = user.id;
            userDomain.password = '';
            
            return toUserApi(userDomain, userDomain.role);
        });

        const validationToken = JwtManage.generateEmailValidationToken(
            result.id!,
            result.email
        );

        await sendEmail({
            to: result.email,
            subject: 'Valida tu cuenta para empezar a usar la aplicación',
            html: `Por favor, haz clic en este enlace para validar tu cuenta: <a href="http://app.com/validate?token=${validationToken}">Validar Cuenta</a>.`,
        });
        
        LoggerManage.info('User registered and validation email sent.', { email: result.email, userId: result.id });
    }
    
    /**
     * @description Obtener al usuario por medio de su UUID
     * @param userId identificador del usuario
     * @returns SuccessResponse<UserApi>
     */
    public async getUserById(userId: string, token: string): Promise<SuccessResponse<UserApi>> {
        const user = await this.userRepository.findUserById(userId);
        const payload = JwtManage.verifyAccessToken(token) as AccessTokenPayload;

        if (payload.role === ROLES.CUSTOMER && payload.sub !== user?.id) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        if (payload.role !== ROLES.SUPPORT && payload.sub !== user?.id) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }
        const role = await this.roleRepository.getRoleByName(user.roleId);
        if (!role) {
            throw new AppException('ROLE_NOT_FOUND');
        }
        const userDomain = userToUserDomain(user, role);
        userDomain.role = roleToRoleDomain(role);
        userDomain.password = '';
        return new SuccessResponse<UserApi>(
            toUserApi(userDomain, userDomain.role),
            {
                code: SUCCESS_MESSAGES.USER_GET_SUCCESS.code,
                message: SUCCESS_MESSAGES.USER_PAGINATE_SUCCESS.message,
            },
            SUCCESS_CODES.OK,
        );
    }

    public async deleteUser(userId: string, token: string): Promise<string> {
        const user = await this.userRepository.findUserById(userId);
        const payload = JwtManage.verifyAccessToken(token) as AccessTokenPayload;

        if (payload.role === ROLES.CUSTOMER && payload.sub !== user?.id) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        if (payload.role !== ROLES.SUPPORT && payload.sub !== user?.id) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }

        const uuid: string = await this.prisma.$transaction(async (tx) => {
            const uuidDelete = await this.userRepository.deleteUser(userId, tx);
            return uuidDelete;
        });
        
        LoggerManage.info('User deleted successfully.', { userId });
        return uuid
    }

    public async paginateUsers(token: string, page: number, limit: number, filterBy?: Filter[], orderBy?: Order): Promise<SuccessResponse<UserApi[]>> {
        const payload = JwtManage.verifyAccessToken(token) as AccessTokenPayload;

        if (payload.role === ROLES.CUSTOMER) {
            throw new AppException('FORBIDDEN_RESOURCE');
        }

        const validFieldsToFilterOrder: string[] = [
            'id',
            'email',
            'fullName',
            'birthDate',
            'isEmailVerified', 
            'isAccountLocked', 
            'loginAttempts', 
            'lockUntil', 
            'lastLogin', 
            'lastLogout',
            'isDeleted', 
            'registeredAt',
            'updatedAt',    
            'role.name',
        ] as const;

        let filter, order;
        if(filterBy) {
            filter = FilterOrderAdapter.buildFilter(filterBy, validFieldsToFilterOrder);
        }

        if(orderBy) {
           order = FilterOrderAdapter.buildOrderBy(orderBy, validFieldsToFilterOrder);
        }

        const [data, total] = await this.userRepository.paginateUsers(page, limit, filter, order);
        const usersApi: UserApi[] = [];

        for (const user of data) {
            const role = await this.roleRepository.getRoleByName(user.roleId);
            if (role) {
                const userDomain = userToUserDomain(user, role);
                userDomain.role = roleToRoleDomain(role);
                userDomain.password = '';
                usersApi.push(toUserApi(userDomain, userDomain.role));
            }
        }

        return new SuccessResponse<UserApi[]>(
            usersApi,
            {
                code: SUCCESS_MESSAGES.USER_PAGINATE_SUCCESS.code,
                message: SUCCESS_MESSAGES.USER_PAGINATE_SUCCESS.message,
            },
            SUCCESS_CODES.OK,
            {
                rows: limit,
                page: page,
                total_data: total
            },
        );
    }
}