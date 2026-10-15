import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth_service';
import { SuccessResponse } from '../../core/model/success';
import { SUCCESS_MESSAGES, SUCCESS_CODES } from '../../core/const/sucess_message';
import { AuthLoginBody, AuthResponse } from './auth_model';
import { CookieOptions } from 'express';
import { uploadMiddleware } from '../../core/config/multer_manage';
import { AppException } from '../../core/exception/app_exception';

/**
 * @description Controlador para manejar las peticiones HTTP relacionadas con la autenticación.
 * Llama a la lógica de negocio en AuthService y maneja la respuesta HTTP.
 */
export class AuthController {
    private authService: AuthService;

    // Configuración de la Cookie para el Refresh Token
    private readonly COOKIE_OPTIONS: CookieOptions = {
        httpOnly: true, // CRITICO: Impide acceso desde JS del cliente
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
        sameSite: 'strict', // Protección contra CSRF
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días en milisegundos (coincide con JWT_REFRESH_EXPIRATION)
    };

    constructor() {
        this.authService = new AuthService();
    }

    /**
     * @description Maneja la solicitud de inicio de sesión.
     */
    public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const credentials: AuthLoginBody = req.body;
        
        const loginData = await this.authService.login(credentials, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.cookie('refreshToken', loginData.refreshToken, this.COOKIE_OPTIONS);
        
        const response = new SuccessResponse(
            { accessToken: loginData.accessToken }, 
            SUCCESS_MESSAGES.LOGIN_SUCCESS, 
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };

    /**
     * @description Maneja la solicitud de registro de usuarios.
     * Nota: Utiliza `req.file` de Multer, que debe ser adjuntado por un middleware anterior en la ruta.
     */
    public register = async (req: Request, res: Response): Promise<void> => {
        const auth: AuthResponse = await this.authService.register(req.body, req.file, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.cookie('refreshToken', auth.refreshToken, this.COOKIE_OPTIONS);

        const response = new SuccessResponse(
            { accessToken: auth.accessToken },
            SUCCESS_MESSAGES.REGISTRATION_SUCCESS,
            SUCCESS_CODES.CREATED
        );

        res.status(response.httpCode).json(response.body);
    };
    
    /**
     * @description Obtiene un nuevo Access Token usando un Refresh Token.
     */
    public refreshToken = async (req: Request, res: Response): Promise<void> => {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            throw new AppException('TOKEN_REQUIRED');
        }
        
        const newTokens = await this.authService.refreshAccessToken(refreshToken, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });

        res.cookie('refreshToken', newTokens.refreshToken, this.COOKIE_OPTIONS);

        const responseData = { accessToken: newTokens.accessToken };

        const response = new SuccessResponse(
            responseData, 
            SUCCESS_MESSAGES.OPERATION_SUCCESSFUL, 
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };

    /**
     * @description Cierra la sesión del usuario (guarda el token en lista negra).
     * Requiere que el middleware de autenticación haya adjuntado el payload en `req.user`.
     */
    public logout = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            throw new AppException('JWT_MISSING_PAYLOAD');
        }

        await this.authService.logout(req.user.sessionId, req.user.sub);

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        const response = new SuccessResponse(
            null, 
            SUCCESS_MESSAGES.LOGOUT_SUCCESS, 
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };

    /**
     * @description Inicia el proceso de restablecimiento de contraseña (solicitar correo).
     */
    public requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
        const { email }: AuthLoginBody = req.body;

        await this.authService.requestPasswordReset(email);

        const response = new SuccessResponse(
            null,
            SUCCESS_MESSAGES.PASSWORD_RESET_INITIATED,
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };

    /**
     * @description Maneja el cambio de contraseña usando el token de restablecimiento.
     */
    public changePassword = async (req: Request, res: Response): Promise<void> => {
        const password: string = req.body.password;
        const token: string = req.body.token;

        await this.authService.changePassword(token, password);
        
        const response = new SuccessResponse(
            null, 
            SUCCESS_MESSAGES.PASSWORD_CHANGED, 
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };

    /**
     * @description Valida el correo electrónico del usuario usando el token del link.
     */
    public validateEmail = async (req: Request, res: Response): Promise<void> => {
        const accessToken: string = req.body.token;

        await this.authService.validateEmail(accessToken);
        
        const response = new SuccessResponse(
            null, 
            SUCCESS_MESSAGES.EMAIL_VALIDATION_SUCCESS, 
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };

    /**
     * @description Valida el correo electrónico del usuario usando el token del link.
     */
    public resendValidateEmail = async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            throw new AppException('JWT_MISSING_PAYLOAD');
        }

        await this.authService.resendValidationEmail(req.user.email);
        
        const response = new SuccessResponse(
            null, 
            SUCCESS_MESSAGES.OPERATION_SUCCESSFUL,
            SUCCESS_CODES.OK
        );
        
        res.status(response.httpCode).json(response.body);
    };
}

// Exportar una instancia para usar en auth_routes.ts
export const authController = new AuthController();