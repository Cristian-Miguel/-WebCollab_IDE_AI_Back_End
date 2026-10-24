import { randomUUID } from 'node:crypto';
import { BcryptManage } from '../../core/config/bcript_manage';
import { JwtManage } from '../../core/config/jwt_manage';
import { RedisPresenceManage } from '../../core/config/redis_manage';
import { LoggerManage } from '../../core/config/logger'; // Asumiendo que has importado LoggerManage
import { AppException } from '../../core/exception/app_exception';
import { PrismaClient, Role, User } from '@prisma/client'; // Importamos tipos de Prisma
import { UserRepository } from '../user/user_repository';
import { AuthLoginBody, AuthResponse, AuthSessionContext } from './auth_model';
import { AuthRepository } from './auth_repository';
import { sendEmail } from '../../core/config/mail_sender'; // Importamos el mail_sender
import { uploadSingleImage } from '../../core/config/multer_manage'
import { toUserDomain, UserApi, UserDomain } from '../user/user_model';
import { DatabaseManage } from '../../core/config/database_manage';
import { RoleRepository } from '../role/role_repository';
import { ROLES } from '../../core/const/roles';
import { roleToRoleDomain } from '../role/role_model';
import { resetPasswordTemplate } from '../../core/email_template/reset_password_template';
import { validationEmailTemplate } from '../../core/email_template/validation_email_template';
import { passwordChangedTemplate } from '../../core/email_template/password_changed_template';

/**
 * @description Servicio que contiene la lógica de negocio para la autenticación (Login, Registro, Tokens, etc.).
 */
export class AuthService {
    private userRepository: UserRepository;
    private authRepository: AuthRepository;
    private roleRepository: RoleRepository;
    private prisma: PrismaClient;
    private static readonly MAX_LOGIN_ATTEMPTS = 5;
    private static readonly LOCKOUT_TIME_MINUTES = 15;
    private static readonly REFRESH_RENEWAL_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;
    
    constructor() {
        this.userRepository = new UserRepository();
        this.authRepository = new AuthRepository();
        this.roleRepository = new RoleRepository();
        this.prisma = DatabaseManage.getInstance();
    }
    
    /**
     * @description Proceso de inicio de sesión completo.
     */
    public async login(credentials: AuthLoginBody, context: AuthSessionContext = {}): Promise<AuthResponse> {
        const startedAt = Date.now();
        const { email, password } = credentials;
        const user = await this.userRepository.findUserByEmail(email);

        if (!user || user.isDeleted) {
            await this.waitForMinimumAuthenticationDuration(startedAt);
            throw new AppException('INVALID_CREDENTIALS');
        }
        
        if (user.isAccountLocked && user.lockUntil && user.lockUntil > new Date()) {
            throw new AppException('ACCOUNT_LOCKED'); 
        }

        const isPasswordMatch = await this.simulateTimeAndCompare(password, user.password, startedAt);

        if (!isPasswordMatch) {
            await this.handleFailedLogin(user); 
            throw new AppException('INVALID_CREDENTIALS');
        }

        await this.userRepository.updateLastLoginAndResetAttempts(user.id);
        
        LoggerManage.info('User logged in successfully.', { email });

        return this.createSessionTokens(
            user.id,
            user.email,
            user.profileImageUrl || '',
            user.role.name,
            context
        );
    }
    
    /**
     * @description Simula un tiempo de procesamiento para evitar ataques de tiempo de ejecución.
     * @param password Contraseña plana.
     * @param hash Contraseña hasheada.
     * @returns [boolean, number] Matcheo y tiempo transcurrido en ms.
     */
    private async simulateTimeAndCompare(password: string, hash: string, startedAt: number): Promise<boolean> {
        const MIN_DURATION_MS = 1000; // 1 segundo (Requerimiento)
        
        const matchPromise = BcryptManage.comparePassword(password, hash);
        const elapsed = Date.now() - startedAt;
        const remainingDelay = MIN_DURATION_MS - elapsed;
        
        if (remainingDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }

        return matchPromise;
    }

    private async waitForMinimumAuthenticationDuration(startedAt: number): Promise<void> {
        const remainingDelay = 1000 - (Date.now() - startedAt);
        if (remainingDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }
    }

    /**
     * @description Maneja el fallo de inicio de sesión, actualiza intentos y bloquea si es necesario.
     * (Implementación omitida por ser genérica)
     */
    private async handleFailedLogin(user: User): Promise<void> {
        const newAttempts = user.loginAttempts + 1;
        let lockUntil: Date | undefined;

        if (newAttempts >= AuthService.MAX_LOGIN_ATTEMPTS) {
            lockUntil = new Date(Date.now() + AuthService.LOCKOUT_TIME_MINUTES * 60 * 1000);
        }

        await this.userRepository.updateLoginAttempts(user.id, newAttempts, lockUntil || null); 
        
        if (lockUntil) {
             throw new AppException('ACCOUNT_LOCKED');
        }
    }

    /**
     * @description Lógica de registro.
     * @param userData Datos de registro.
     * @param profileImageFile Archivo de imagen subido por Multer.
     */
    public async register(
        userData: UserApi,
        profileImageFile: Express.Multer.File | undefined,
        context: AuthSessionContext = {}
    ): Promise<AuthResponse> {
        const { password } = userData;

        let profileImageUrl: string = '';
        if (profileImageFile) {
            profileImageUrl = await uploadSingleImage(profileImageFile.fieldname);
        }

        if (!password) {
            throw new AppException('PASSWORD_REQUIRED');
        }

        const passwordHash = await BcryptManage.hashPassword(password);
        const userRegister = await this.userRepository.findUserByEmail(userData.email);

        if (userRegister && !userRegister.isDeleted) {
            throw new AppException('USER_ALREADY_EXISTS', null, 'Ya existe una cuenta con este correo electrónico.');
        }

        const birthDate = new Date(userData.birthDate);
        if (Number.isNaN(birthDate.getTime())) {
            throw new AppException('INVALID_FORMAT', null, 'La fecha de nacimiento no es válida.');
        }

        const result: UserDomain = await this.prisma.$transaction(async (tx) => {
            const userDomain: UserDomain = toUserDomain({ ...userData, birthDate });
            const role: Role = await this.roleRepository.getRoleByName(ROLES.CUSTOMER);
            userDomain.role = roleToRoleDomain(role);
            userDomain.roleId = role.id;

            userDomain.password = passwordHash;
            userDomain.profileImageUrl = profileImageUrl;

            const user: User = await this.userRepository.createUser(
                userDomain,
                tx
            );
            userDomain.id = user.id
            return userDomain;
        });
        
        const validationToken = JwtManage.generateEmailValidationToken(
            result.id!,
            result.email
        );

        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const validationLink = `${frontendBaseUrl}/validate-email/${validationToken}`;

        // 4. Generar el contenido estilizado del correo
        const emailContent = validationEmailTemplate(userData.fullName, validationLink);

        await sendEmail({
            to: result.email,
            subject: 'Valida tu cuenta para empezar a usar la aplicación',
            html: emailContent,
        });
        
        LoggerManage.info('User registered and validation email sent.', { email: result.email });
        await this.userRepository.updateLastLoginAndResetAttempts(result.id!);

        return this.createSessionTokens(
            result.id!,
            result.email,
            result.profileImageUrl || '',
            'CUSTOMER',
            context
        );
    }

    private async createSessionTokens(
        userId: string,
        email: string,
        profileImageUrl: string,
        role: string,
        context: AuthSessionContext
    ): Promise<AuthResponse> {
        const sessionId = randomUUID();
        const accessToken = JwtManage.generateAccessToken(
            userId,
            email,
            profileImageUrl,
            role,
            sessionId
        );
        const refreshToken = JwtManage.generateRefreshToken(userId, email, sessionId);
        const expiresAt = JwtManage.getExpiredAtFromToken(refreshToken);

        if (!expiresAt) {
            throw new AppException('JWT_REFRESH_EXPIRED');
        }

        await this.authRepository.createSession({
            id: sessionId,
            userId,
            refreshTokenHash: await BcryptManage.hashTokenForBlacklist(refreshToken),
            expiresAt,
            ip: context.ip,
            userAgent: context.userAgent?.slice(0, 512),
        });

        return { accessToken, refreshToken };
    }

    /**
     * HU-25: Cierra la sesión del usuario, extrae el `jti` y `exp` del Access Token actual
     * y lo registra en la lista negra de Redis (`blacklist:token:<jti>`) con el TTL restante.
     */
    public async logout(sessionId: string, userId: string, accessToken?: string): Promise<void> {
        const user = await this.userRepository.findUserById(userId);
        if (!user || user.isDeleted) {
            throw new AppException('SESSION_INACTIVE');
        }

        if (accessToken) {
            const { jti, exp } = JwtManage.extractJtiAndExp(accessToken);
            const effectiveJti = jti || sessionId;
            const ttlSeconds = RedisPresenceManage.calculateRemainingTtlSeconds(exp);
            if (effectiveJti && ttlSeconds > 0) {
                await RedisPresenceManage.blacklistToken(effectiveJti, ttlSeconds);
            }
        }

        await this.prisma.$transaction(async (tx) => {
            const invalidated = await this.authRepository.invalidateSession(sessionId, userId, tx);
            if (!invalidated) {
                throw new AppException('SESSION_INACTIVE');
            }

            await this.userRepository.updateLastLogout(userId, tx);
        });

        LoggerManage.info('User logged out and token blacklisted.', { userId, sessionId });
    }

    /**
     * @description Genera un nuevo Access Token y Refresh Token si el actual es válido.
     */
    public async refreshAccessToken(
        refreshToken: string,
        context: AuthSessionContext = {}
    ): Promise<AuthResponse> {
        let payload: ReturnType<typeof JwtManage.verifyRefreshToken>;
        try {
            payload = JwtManage.verifyRefreshToken(refreshToken);
        } catch (error) {
            throw new AppException('SESSION_INACTIVE', error, 'Su sesión ha expirado. Inicie sesión nuevamente.');
        }

        const expiresAt = JwtManage.getExpiredAtFromToken(refreshToken);
        if (!expiresAt) {
            throw new AppException('JWT_REFRESH_EXPIRED');
        }

        const tokenHash: string = await BcryptManage.hashTokenForBlacklist(refreshToken);
        const isActive = await this.authRepository.hasActiveSession(
            payload.sessionId,
            payload.sub,
            tokenHash
        );
        if (!isActive) {
            throw new AppException('SESSION_INACTIVE');
        }

        const user = await this.userRepository.findUserById(payload.sub);
        
        if (!user || user.isDeleted) {
            throw new AppException('SESSION_INACTIVE');
        }

        let sessionId = payload.sessionId;
        let newRefreshToken = refreshToken;
        if (expiresAt.getTime() - Date.now() <= AuthService.REFRESH_RENEWAL_THRESHOLD_MS) {
            sessionId = randomUUID();
            newRefreshToken = JwtManage.generateRefreshToken(user.id, user.email, sessionId);
            const newExpiresAt = JwtManage.getExpiredAtFromToken(newRefreshToken);
            if (!newExpiresAt) {
                throw new AppException('JWT_REFRESH_EXPIRED');
            }

            await this.prisma.$transaction(async (tx) => {
                const invalidated = await this.authRepository.invalidateSession(
                    payload.sessionId,
                    user.id,
                    tx,
                    tokenHash
                );
                if (!invalidated) {
                    throw new AppException('SESSION_INACTIVE');
                }

                await this.authRepository.createSession({
                    id: sessionId,
                    userId: user.id,
                    refreshTokenHash: await BcryptManage.hashTokenForBlacklist(newRefreshToken),
                    expiresAt: newExpiresAt,
                    ip: context.ip,
                    userAgent: context.userAgent?.slice(0, 512),
                }, tx);
            });
        }

        const newAccessToken = JwtManage.generateAccessToken(
            user.id,
            user.email,
            user.profileImageUrl || '',
            user.role.name,
            sessionId
        );
        
        LoggerManage.info('Tokens refreshed.', { userId: user.id });

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }

    /**
     * @description Inicia el flujo de restablecimiento de contraseña.
     */
    public async requestPasswordReset(email: string): Promise<void> {
        const user = await this.userRepository.findUserByEmail(email);

        if (!user || user.isDeleted) {
            LoggerManage.warn('Password reset request for non-existent/inactive user.', { email });
            return;
        }
        
        const resetToken = JwtManage.generatePasswordResetToken(user.id, user.email);
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendBaseUrl}/forgot-password/${resetToken}`;

        const emailContent = resetPasswordTemplate(user.fullName || user.email, resetLink);

        await sendEmail({
            to: user.email,
            subject: 'Instrucciones para Restablecer tu Contraseña',
            html: emailContent,
        });
        
        LoggerManage.info('Password reset initiated.', { email: user.email });
    }

    /**
     * @description Completa el cambio de contraseña.
     */
    public async changePassword(token: string, newPassword: string): Promise<void> {
        if (!token) {
            throw new AppException('TOKEN_REQUIRED');
        }

        if (!newPassword) {
            throw new AppException('PASSWORD_REQUIRED');
        }

        const payload = JwtManage.verifyPasswordResetToken(token);
        const expiredTokenDate: undefined | Date = JwtManage.getExpiredAtFromToken(token);

        if (!expiredTokenDate || expiredTokenDate < new Date()) {
            throw new AppException('JWT_INVALID');
        }

        const tokenHash: string = await BcryptManage.hashTokenForBlacklist(token);
        
        if(await this.authRepository.isBlockToken(tokenHash)){
            throw new AppException('TOKEN_ALREADY_USED');
        }
        
        const user = await this.userRepository.findUserById(payload.sub);
        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }

        const newPasswordHash = await BcryptManage.hashPassword(newPassword);

        await this.prisma.$transaction(async (tx) => {
            await this.userRepository.changePassword(user.id, newPasswordHash, tx);
            await this.authRepository.invalidateUserSessions(user.id, tx);
            await this.authRepository.saveBlockToken(
                tokenHash,
                JwtManage.getExpiredAtFromToken(token)!,
                user.id,
                tx
            );
        });

        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; 
        const loginUrl = `${frontendBaseUrl}/login`;

        const emailContent = passwordChangedTemplate(user.fullName || user.email, loginUrl);

        await sendEmail({ 
            to: user.email, 
            subject: 'Contraseña Cambiada con Éxito', 
            html: emailContent
        });
        
        LoggerManage.info('Password successfully changed.', { email: user.email });
    }

    /**
     * @description Valida el correo electrónico del usuario. 
     */
    public async validateEmail(validationToken: string): Promise<void> {
        if (!validationToken) {
            throw new AppException('TOKEN_REQUIRED');
        }

        const payload = JwtManage.verifyEmailValidationToken(validationToken);
        const tokenHash: string = await BcryptManage.hashTokenForBlacklist(validationToken);
        const expiredTokenDate: undefined | Date = JwtManage.getExpiredAtFromToken(validationToken);
        
        if(await this.authRepository.isBlockToken(tokenHash)){
            throw new AppException('TOKEN_ALREADY_USED');
        }

        if(!expiredTokenDate || expiredTokenDate < new Date()){
            throw new AppException('JWT_INVALID');
        }
        
        const user = await this.userRepository.findUserById(payload.sub);
        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }
        
        if (user.isEmailVerified) {
            LoggerManage.warn('Attempt to validate already validated email.', { email: user.email });
            return;
        }

        await this.prisma.$transaction(async (tx) => {
            await this.userRepository.validateEmail(user.id, tx);

            await this.authRepository.saveBlockToken(
                tokenHash, 
                expiredTokenDate,
                user.id, 
                tx
            );
        });
        
        LoggerManage.info('Email successfully validated.', { email: user.email });
    }

    public async resendValidationEmail(email: string): Promise<void> {
        const user = await this.userRepository.findUserByEmail(email);
        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }
        if (user.isEmailVerified) {
            LoggerManage.warn('Attempt to resend validation email for already verified email.', { email: user.email });
            throw new AppException('EMAIL_ALREADY_VALIDATED');
        }

        const validationToken = JwtManage.generateEmailValidationToken(
            user.id,
            user.email
        );

        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const validationLink = `${frontendBaseUrl}/validate-email/${validationToken}`;

        // 4. Generar el contenido estilizado del correo
        const emailContent = validationEmailTemplate(user.fullName, validationLink);

        await sendEmail({
            to: user.email,
            subject: 'Valida tu cuenta para empezar a usar la aplicación',
            html: emailContent,
        });
        
        LoggerManage.info('Validation email resent.', { email: user.email });
    }

    public calcularDiasFaltantes(fechaActual: Date, fechaFutura: Date): number {
        const msPorDia = 1000 * 60 * 60 * 24;

        const diferenciaMs = fechaFutura.getTime() - fechaActual.getTime();

        const diasFaltantes = Math.floor(diferenciaMs / msPorDia);

        return diasFaltantes;
    }
}
