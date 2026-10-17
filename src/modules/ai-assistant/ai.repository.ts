import { PrismaClient, SugerenciaIA, EstadoSesion } from '@prisma/client';
import { prisma } from '../../core/config/database_manage';

export interface CreateAISuggestionData {
    sesionId: string;
    usuarioId: string;
    prompt: string;
    respuesta: string;
}

export class AIRepository {
    private client: PrismaClient;

    constructor(client: PrismaClient = prisma) {
        this.client = client;
    }

    /**
     * Resuelve un sesionId válido para asociar el registro en SugerenciaIA.
     * Si no se envía sesionId en el payload, busca la sesión activa más reciente del usuario.
     */
    public async resolveSessionId(usuarioId: string, providedSessionId?: string): Promise<string> {
        if (providedSessionId) {
            const existingSession = await this.client.sesionColaborativa.findUnique({
                where: { id: providedSessionId },
            });
            if (existingSession) {
                return existingSession.id;
            }
        }

        const participation = await this.client.participanteSesion.findFirst({
            where: { usuarioId },
            orderBy: { createdAt: 'desc' },
        });

        if (participation) {
            return participation.sesionId;
        }

        const ownedSession = await this.client.sesionColaborativa.findFirst({
            where: { propietarioId: usuarioId },
            orderBy: { createdAt: 'desc' },
        });

        if (ownedSession) {
            return ownedSession.id;
        }

        const fallbackSession = await this.client.sesionColaborativa.create({
            data: {
                nombre: 'Sesión Asistencia IA',
                descripcion: 'Sesión generada automáticamente para sugerencias de IA',
                propietarioId: usuarioId,
                estado: EstadoSesion.ACTIVA,
            },
        });

        return fallbackSession.id;
    }

    /**
     * Persiste la interacción (prompt y respuesta) en la tabla SugerenciaIA de PostgreSQL.
     */
    public async createSuggestion(data: CreateAISuggestionData): Promise<SugerenciaIA> {
        return await this.client.sugerenciaIA.create({
            data: {
                sesionId: data.sesionId,
                usuarioId: data.usuarioId,
                prompt: data.prompt,
                respuesta: data.respuesta,
            },
        });
    }

    /**
     * Obtiene el historial de sugerencias de IA para una sesión.
     */
    public async findBySessionId(sesionId: string): Promise<SugerenciaIA[]> {
        return await this.client.sugerenciaIA.findMany({
            where: { sesionId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
