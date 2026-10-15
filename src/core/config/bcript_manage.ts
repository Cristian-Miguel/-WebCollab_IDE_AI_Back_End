import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Clase de gestión para el hashing y verificación de contraseñas utilizando bcryptjs.
 * Encapsula la complejidad del proceso de encriptación para el módulo de autenticación.
 */
export class BcryptManage {
    private static readonly SECRET_ENCODE_DATA_KEY =
        process.env.SECRET_ENCODE_DATA_KEY || process.env.JWT_SECRET || process.env.SECRET_KEY || '';

    // El número de rondas de salting (cost factor).
    // Un valor de 10 es un buen equilibrio entre seguridad y rendimiento para la mayoría de los casos.
    private static readonly SALT_ROUNDS = 10;

    /**
     * Hashea un token plana.
     * * @param token El token en texto plano que se va a encriptar.
     * @returns Una promesa que resuelve con el hash del token.
     */
    public static async hashTokenForBlacklist(token: string): Promise<string> {
        if (!BcryptManage.SECRET_ENCODE_DATA_KEY) {
            throw new Error('A token hashing secret must be configured.');
        }

        return crypto
            .createHmac('sha256', BcryptManage.SECRET_ENCODE_DATA_KEY)
            .update(token)
            .digest('hex');
    }

    /**
     * Hashea una contraseña plana.
     * * @param password La contraseña en texto plano que se va a encriptar.
     * @returns Una promesa que resuelve con el hash de la contraseña.
     */
    public static async hashPassword(password: string): Promise<string> {
        // Genera el salt y luego hashea la contraseña en un solo paso
        // utilizando el factor de costo definido.
        return bcrypt.hash(password, BcryptManage.SALT_ROUNDS);
    }

    /**
     * Compara una contraseña plana con un hash existente.
     * * @param password La contraseña en texto plano introducida por el usuario.
     * @param hash El hash almacenado en la base de datos (Prisma).
     * @returns Una promesa que resuelve a 'true' si las contraseñas coinciden, 'false' en caso contrario.
     */
    public static async comparePassword(password: string, hash: string): Promise<boolean> {
        // bcryptjs maneja automáticamente la extracción del salt desde el hash
        // para realizar la comparación.
        return bcrypt.compare(password, hash);
    }
}
