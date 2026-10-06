import { PrismaClient } from '@prisma/client';

/**
 * Clase Singleton para gestionar la conexión a la base de datos usando PrismaClient.
 * Implementa la inicialización de la instancia y la desconexión.
 */
export class DatabaseManage {
    // La instancia de PrismaClient debe ser accesible globalmente dentro de la aplicación
    private static instance: PrismaClient;

    // Constructor privado para evitar la instanciación directa
    private constructor() {
        // Inicialización de Prisma Client
        DatabaseManage.instance = new PrismaClient({
            log: [
                { level: 'query', emit: 'event' },
                { level: 'info', emit: 'stdout' },
                { level: 'warn', emit: 'stdout' },
                { level: 'error', emit: 'stdout' },
            ],
        });

        // Configurar un listener para logs de consultas si es necesario (ej. para Winston)
        // (DatabaseManage.instance as any).$on('query', (e: any) => {
        //     console.log('Query: ' + e.query);
        // });
    }

    /**
     * Obtiene la única instancia de PrismaClient.
     * @returns Instancia de PrismaClient.
     */
    public static getInstance(): PrismaClient {
        if (!DatabaseManage.instance) {
            // Llama al constructor privado si no existe la instancia
            new DatabaseManage();
        }
        return DatabaseManage.instance;
    }

    /**
     * Desconecta el cliente de Prisma de la base de datos.
     * Debería llamarse al cerrar el servidor (ej. en el evento SIGINT).
     */
    public static async disconnect(): Promise<void> {
        if (DatabaseManage.instance) {
            await DatabaseManage.instance.$disconnect();
            console.log('[DB] Prisma client disconnected.');
        }
    }
}

// Exportamos la instancia directamente para facilitar su uso en los Repositorios
export const prisma = DatabaseManage.getInstance();
