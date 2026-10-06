import { PrismaClient, User, RevokedToken, Role, ROLE_TYPE, Prisma } from '@prisma/client';
import { DatabaseManage } from '../../core/config/database_manage';
import { DBException } from '../../core/exception/db_exception';
import { PrismaClientInitializationError, PrismaClientKnownRequestError, PrismaClientRustPanicError, PrismaClientUnknownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { UserDomain } from './user_model';

/**
 * @description Repositorio centralizado para operaciones de base de datos del modelo User.
 * Encapsula la interacción directa con Prisma, traduciendo errores a DBException.
 */
export class UserRepository {
    private prisma: PrismaClient;

    constructor() {
        // Obtener la única instancia de Prisma
        this.prisma = DatabaseManage.getInstance();
    }

    /**
     * @description Busca un usuario por su correo electrónico, incluyendo su rol.
     * @param email El correo electrónico del usuario.
     * @returns Una promesa que resuelve con el objeto UserWithRole o null.
     */
    public async findUserByEmail(email: string): Promise<(User & { role: Role }) | null> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { email },
                include: { role: true } // Incluir el rol (necesario para el token)
            });
            return user;
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error buscando usuario por email: ${email}`);
            }
            throw error;
        }
    }

    /**
     * @description Busca un usuario por su UUID, incluyendo su rol.
     * @param userId El UUID del usuario.
     * @returns Una promesa que resuelve con el objeto UserWithRole o null.
     */
    public async findUserById(userId: string): Promise<(User & { role: Role }) | null> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { role: true } 
            });
            return user;
        } catch (error) {
             if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error buscando usuario por ID: ${userId}`);
            }
            throw error;
        }
    }

    /**
     * @description Busca un rol por su nombre.
     * @param name Nombre del rol (ej: 'customer').
     */
    public async findRoleByName(name: string): Promise<Role | null> {
        try {
            let role: ROLE_TYPE = ROLE_TYPE.CUSTOMER;
            if (name.toUpperCase() === 'ADMINISTRATOR') {
                role = ROLE_TYPE.ADMINISTRATOR;
            } else if (name.toUpperCase() === 'SUPPORT') {
                role = ROLE_TYPE.SUPPORT;
            } else {
                    role = ROLE_TYPE.CUSTOMER;
            }
            return await this.prisma.role.findUnique({
                where: { name: role },
            });
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error buscando rol: ${name}`);
            }
            throw error;
        }
    }

    /**
     * @description Crea un nuevo usuario y su registro de dirección asociado.
     * @param data Datos del nuevo usuario.
     * @param passwordHash El hash de la contraseña (ya encriptado).
     * @param defaultRoleId El ID del rol por defecto ('customer').
     */
    public async createUser(userDomain: UserDomain, tx: Prisma.TransactionClient): Promise<User> {
        // const { address, ...userData } = userDomain;
        try {
            const result: User = await tx.user.create({
                data: {
                    email: userDomain.email,
                    password: userDomain.password,
                    fullName: userDomain.fullName,
                    rfc: userDomain.rfc,
                    curp: userDomain.curp,
                    birthDate: userDomain.birthDate,
                    profileImageUrl: userDomain.profileImageUrl,
                    isEmailVerified: false,
                    isAccountLocked: false,
                    loginAttempts: 0,
                    lockUntil: null,
                    lastLogin: null,
                    lastLogout: null,
                    isDeleted: false,
                    roleId: userDomain.roleId,
                    addressId: userDomain.addressId,
                },
            });

            return result;
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error al crear el usuario: ${userDomain.email}`);
            } else if (error instanceof PrismaClientValidationError) {
                throw new DBException(error, `Error al validar los datos: ${userDomain.email}`);
            } else if(error instanceof PrismaClientInitializationError || error instanceof PrismaClientRustPanicError ||
                error instanceof PrismaClientUnknownRequestError
            ) {
                 throw new DBException(error, `Error desconocido al crear un: ${userDomain.email}`);
            }
            
            throw error;
        }
    }

    public async updateUser(userData: UserDomain, tx: Prisma.TransactionClient): Promise<User> {
        try {
            let roleChange: ROLE_TYPE = ROLE_TYPE.CUSTOMER;
            // if (userData.role.name.toUpperCase() === 'ADMINISTRATOR') {
            //     role = ROLE_TYPE.SUPPORT;
            // } else 
            if (userData.role.name.toUpperCase() === 'SUPPORT') {
                roleChange = ROLE_TYPE.SUPPORT;
            } else {
                roleChange = ROLE_TYPE.CUSTOMER;
            }

            const rolId = await tx.role.findUnique({
                where: { name: roleChange },
                select: { id: true }
            });

            const user = await tx.user.update({
                where: { id: userData.id! },
                data: {
                    birthDate: userData.birthDate,
                    email: userData.email,
                    fullName: userData.fullName,
                    roleId: rolId!.id,
                    rfc: userData.rfc,
                    curp: userData.curp
                },
                include: { role: true, address: true }
            });

            return user;
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error al crear el usuario: ${userData.email}`);
            }
            throw error;
        }
    }
    
    /**
     * @description Actualiza la hora del último login y resetea los intentos fallidos a cero.
     * @param userId UUID del usuario.
     */
    public async updateLastLoginAndResetAttempts(userId: string): Promise<void> {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    lastLogin: new Date(),
                    loginAttempts: 0, 
                    isAccountLocked: false,
                    lockUntil: null,
                },
            });
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error actualizando el último login del usuario: ${userId}`);
            }
            throw error;
        }
    }

    /**
     * @description Actualiza los intentos de login, la hora del último intento, y el estado de bloqueo.
     * (Usado en caso de login fallido).
     * @param userId UUID del usuario.
     * @param attempts Número actual de intentos.
     * @param lockUntil Fecha de bloqueo (si aplica, null si no está bloqueado).
     */
    public async updateLoginAttempts(userId: string, attempts: number, lockUntil: Date | null): Promise<void> {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    loginAttempts: attempts,
                    lastLogin: new Date(),
                    isAccountLocked: !!lockUntil,
                    lockUntil: lockUntil,
                },
            });
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error actualizando intentos de login para: ${userId}`);
            }
            throw error;
        }
    }
    
    /**
     * @description Registra la hora de la última salida de sesión (logout).
     * @param userId UUID del usuario.
     */
    public async updateLastLogout(userId: string, tx: Prisma.TransactionClient): Promise<void> {
        try {
            await tx.user.update({
                where: { id: userId },
                data: {
                    lastLogout: new Date(),
                },
            });
        } catch (error) {
             if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error registrando la salida de sesión para: ${userId}`);
            }
            throw error;
        }
    }

    /**
     * @description Cambia la contraseña de un usuario.
     * Requerimiento: Modificar la contraseña y la columna de última modificación del usuario.
     * @param userId UUID del usuario.
     * @param newPasswordHash El hash de la nueva contraseña.
     */
    public async changePassword(userId: string, newPasswordHash: string, tx: Prisma.TransactionClient): Promise<void> {
        try {
            await tx.user.update({
                where: { id: userId },
                data: {
                    password: newPasswordHash,
                    loginAttempts: 0, 
                    isAccountLocked: false,
                    lockUntil: null,
                },
            });
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error al cambiar la contraseña del usuario: ${userId}`);
            }
            throw error;
        }
    }

    /**
     * @description Marca el correo del usuario como validado.
     * @param userId UUID del usuario.
     */
    public async validateEmail(userId: string, tx: Prisma.TransactionClient): Promise<void> {
        try {
            await tx.user.update({
                where: { id: userId },
                data: {
                    isEmailVerified: true,
                },
            });
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error al validar el correo del usuario: ${userId}`);
            }
            throw error;
        }
    }

    public async paginateUsers(
        skip: number,
        take: number,
        filter?: any,
        order?: any,
    ): Promise<any[]> {
        try {
            const [ data, total ] = await Promise.all([
                this.prisma.user.findMany({
                    skip,
                    take,
                    orderBy: order ? order : '',
                    where: filter ? filter : '',
                }),
                this.prisma.user.count({ where: filter })
            ]);
            return [data, total]
        } catch(error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error al paginar usuarios.`);
            }
            throw error;
        }
    }

    /**
     * @description Borrar fisicamente al usuario, pero cambiando las partes importantes por cosas genericas
     * @param userId UUID del usuario que se desea borrar
     * @param tx Transaccion de para hacer rollback si sucede un problema
     * @returns UUID del usuario eliminado de los datos.
     */
    public async deleteUser(userId: string, tx: Prisma.TransactionClient): Promise<string> {
        try {
            tx.user.update({
                where:{ id:userId },
                data:{
                    fullName:'Delete',
                    email: userId,
                    password: 'Delete',
                    rfc: userId,
                    curp: userId,
                    birthDate: '1900/01/01',
                    isAccountLocked: true,
                    isDeleted: true,
                }
            });
            return userId;
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, `Error al paginar usuarios.`);
            }
            throw error; 
        }
    }
}