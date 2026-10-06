import { BcryptManage } from '../../core/config/bcript_manage';
import { JwtManage, AccessTokenPayload, RefreshTokenPayload } from '../../core/config/jwt_manage';
import { LoggerManage } from '../../core/config/logger'; // Asumiendo que has importado LoggerManage
import { AppException } from '../../core/exception/app_exception';
import { Address, PrismaClient, Role, User } from '@prisma/client'; // Importamos tipos de Prisma
import { UserRepository } from '../user/user_repository';
import { AuthLoginBody, AuthResponse } from './auth_model';
import { AuthRepository } from './auth_repository';
import { sendEmail } from '../../core/config/mail_sender'; // Importamos el mail_sender
import { uploadSingleImage } from '../../core/config/multer_manage'
import { toUserDomain, UserApi, UserDomain, userToUserDomain } from '../user/user_model';
import { DatabaseManage } from '../../core/config/database_manage';
import { AddressRepository } from '../address/address_repository';
import { RoleRepository } from '../role/role_repository';
import { ROLES } from '../../core/const/roles';
import { roleToRoleDomain } from '../role/role_model';
import { addressToAddressDomain } from '../address/address_model';
import { resetPasswordTemplate } from '../../core/email_template/reset_password_template';
import { validationEmailTemplate } from '../../core/email_template/validation_email_template';
import { passwordChangedTemplate } from '../../core/email_template/password_changed_template';

/**
 * @description Servicio que contiene la lógica de negocio para la autenticación (Login, Registro, Tokens, etc.).
 */
export class AuthService {
    private userRepository: UserRepository;
    private authRepository: AuthRepository;
    private addressRepository: AddressRepository;
    private roleRepository: RoleRepository;
    private prisma: PrismaClient;
    private static readonly MAX_LOGIN_ATTEMPTS = 5;
    private static readonly LOCKOUT_TIME_MINUTES = 15;
    
    constructor() {
        this.userRepository = new UserRepository();
        this.authRepository = new AuthRepository();
        this.addressRepository = new AddressRepository();
        this.roleRepository = new RoleRepository();
        this.prisma = DatabaseManage.getInstance();
    }
    
    /**
     * @description Proceso de inicio de sesión completo.
     */
    public async login(credentials: AuthLoginBody): Promise<AuthResponse> {
        const { email, password } = credentials;
        const user = await this.userRepository.findUserByEmail(email);

        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND'); 
        }
        
        if (user.isAccountLocked && user.lockUntil && user.lockUntil > new Date()) {
            throw new AppException('ACCOUNT_LOCKED'); 
        }

        const [isPasswordMatch] = await this.simulateTimeAndCompare(password, user.password);

        if (!isPasswordMatch) {
            await this.handleFailedLogin(user); 
            throw new AppException('INVALID_CREDENTIALS');
        }

        const accessToken = JwtManage.generateAccessToken(
            user.id,
            user.email,
            user.profileImageUrl || '',
            user.role.name
        );
        const refreshToken = JwtManage.generateRefreshToken(
            user.id,
            user.email,
        );

        await this.userRepository.updateLastLoginAndResetAttempts(user.id);
        
        LoggerManage.info('User logged in successfully.', { email });

        return { accessToken: accessToken, refreshToken };
    }
    
    /**
     * @description Simula un tiempo de procesamiento para evitar ataques de tiempo de ejecución.
     * @param password Contraseña plana.
     * @param hash Contraseña hasheada.
     * @returns [boolean, number] Matcheo y tiempo transcurrido en ms.
     */
    private async simulateTimeAndCompare(password: string, hash: string): Promise<[boolean, number]> {
        const MIN_DURATION_MS = 1000; // 1 segundo (Requerimiento)
        const start = Date.now();
        
        const matchPromise = BcryptManage.comparePassword(password, hash);
        const elapsed = Date.now() - start;
        const remainingDelay = MIN_DURATION_MS - elapsed;
        
        if (remainingDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }

        const isMatch = await matchPromise;
        const finalDuration = Date.now() - start;

        return [isMatch, finalDuration];
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
    public async register(userData: UserApi, profileImageFile: Express.Multer.File | undefined): Promise<AuthResponse> {
        const { password, ...rest } = userData;

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

        const result: UserDomain = await this.prisma.$transaction(async (tx) => {
            const userDomain: UserDomain = toUserDomain(userData); 
            const role: Role = await this.roleRepository.getRoleByName(ROLES.CUSTOMER);
            userDomain.role = roleToRoleDomain(role);
            userDomain.roleId = role.id;

            const address: Address = await this.addressRepository.createAddress(userDomain.address, tx);
            userDomain.address = addressToAddressDomain(address);
            userDomain.addressId = address.id;
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
        const accessToken = JwtManage.generateAccessToken(
            result.id!,
            result.email,
            result.profileImageUrl || '',
            'CUSTOMER'
        );
        const refreshToken = JwtManage.generateRefreshToken(
            result.id!,
            result.email,
        );

        await this.userRepository.updateLastLoginAndResetAttempts(result.id!);

        return { accessToken, refreshToken };
    }

    /**
     * @description Cierra la sesión y guarda el token en la lista negra.
     */
    public async logout(accessToken: string, refreshToken: string): Promise<void> {
        const payload = JwtManage.verifyAccessToken(refreshToken) as AccessTokenPayload;
        const exp: Date | undefined = JwtManage.getExpiredAtFromToken(refreshToken);
        const tokenHash: string = await BcryptManage.hashTokenForBlacklist(refreshToken);

        const user: User | null  = await this.userRepository.findUserById(payload.sub);
        const userEmail = user ? user.email : 'unknown';

        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND', null, 'No existe esa cuenta.');
        }

        await this.prisma.$transaction(async (tx) => {
            await this.userRepository.updateLastLogout(user.id, tx);

            await this.authRepository.saveBlockToken(tokenHash, exp!, user.id, tx);
        });
        
        LoggerManage.info('User logged out.', { userEmail });
    }

    /**
     * @description Genera un nuevo Access Token y Refresh Token si el actual es válido.
     */
    public async refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
        const payload = JwtManage.verifyRefreshToken(refreshToken);
        let expiredRefreshToken: Date | undefined;
        try {
            expiredRefreshToken = JwtManage.getExpiredAtFromToken(refreshToken);
        } catch (error) {
            throw new AppException('SESSION_INACTIVE', null, 'Su sesión ha expirado por inactividad. Inicie sesión nuevamente.'); 
        }
        
        const DAYS_THRESHOLD = 5;
        
        if(!expiredRefreshToken){
            throw new AppException('JWT_REFRESH_EXPIRED');
        }

        const daysToExpire = this.calcularDiasFaltantes(new Date(), expiredRefreshToken);
        const tokenHash: string = await BcryptManage.hashTokenForBlacklist(refreshToken);

        if(await this.authRepository.isBlockToken(tokenHash)){
            throw new AppException('SESSION_INACTIVE', null, 'Su sesión ha expirado por inactividad. Inicie sesión nuevamente.');
        }

        const user = await this.userRepository.findUserById(payload.sub);
        
        if (!user || user.isDeleted) {
            throw new AppException('USER_NOT_FOUND');
        }

        const newAccessToken = JwtManage.generateAccessToken(
            user.id,
            user.email,
            user.profileImageUrl || '',
            user.role.name
        );

        let newRefreshToken:string = refreshToken;

        if(DAYS_THRESHOLD >= daysToExpire){
            newRefreshToken = JwtManage.generateRefreshToken(
                user.id,
                user.email
            );

            await this.prisma.$transaction(async (tx) => {
                await this.authRepository.saveBlockToken(tokenHash, expiredRefreshToken, user.id, tx)
            });
        }
        
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

