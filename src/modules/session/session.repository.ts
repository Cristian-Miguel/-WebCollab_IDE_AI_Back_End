import { PrismaClient, SesionColaborativa, ParticipanteSesion, RolParticipante, EstadoSesion } from '@prisma/client';
import { prisma } from '../../core/config/database_manage';
import { AppException } from '../../core/exception/app_exception';

export const MAX_ACTIVE_PARTICIPANTS = 4;

export interface CreateSessionData {
    nombre: string;
    descripcion?: string;
    propietarioId: string;
}

export interface ParticipantWithUser extends ParticipanteSesion {
    usuario?: {
        id: string;
        email: string;
        fullName: string;
    };
}

export interface JoinSessionResult {
    session: SesionColaborativa;
    participant: ParticipanteSesion;
    participants: ParticipantWithUser[];
}

export class SessionRepository {
    private client: PrismaClient;

    constructor(client: PrismaClient = prisma) {
        this.client = client;
    }

    /**
     * Ejecuta una transacción atómica para crear la SesionColaborativa,
     * registrar al creador como ParticipanteSesion con rol PROPIETARIO,
     * e inicializar el ArchivoProyecto con plantillas base.
     */
    public async createSessionTransaction(data: CreateSessionData): Promise<SesionColaborativa> {
        return await this.client.$transaction(async (tx) => {
            const nuevaSesion = await tx.sesionColaborativa.create({
                data: {
                    nombre: data.nombre,
                    descripcion: data.descripcion || null,
                    propietarioId: data.propietarioId,
                    estado: EstadoSesion.ACTIVA,
                },
            });

            await tx.participanteSesion.create({
                data: {
                    sesionId: nuevaSesion.id,
                    usuarioId: data.propietarioId,
                    rol: RolParticipante.PROPIETARIO,
                    activo: true,
                },
            });

            await tx.archivoProyecto.create({
                data: {
                    sesionId: nuevaSesion.id,
                    html: '<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8">\n  <title>Proyecto</title>\n</head>\n<body>\n  <h1>Hola Mundo</h1>\n</body>\n</html>',
                    css: '/* Estilos del proyecto */\nbody {\n  font-family: sans-serif;\n  margin: 20px;\n}',
                    javascript: '// Código JavaScript\nconsole.log("Sesión iniciada");',
                },
            });

            return nuevaSesion;
        });
    }

    /**
     * Busca una sesión por su UUID incluyendo sus participantes y archivos.
     */
    public async findById(id: string): Promise<SesionColaborativa | null> {
        return await this.client.sesionColaborativa.findUnique({
            where: { id },
            include: {
                participantes: {
                    include: {
                        usuario: {
                            select: {
                                id: true,
                                email: true,
                                fullName: true,
                            },
                        },
                    },
                },
                archivoProyecto: true,
            },
        });
    }

    /**
     * Cuenta el número de participantes activos en una sesión.
     */
    public async countActiveParticipants(sesionId: string): Promise<number> {
        return await this.client.participanteSesion.count({
            where: {
                sesionId,
                activo: true,
            },
        });
    }

    /**
     * Obtiene la lista actualizada de participantes activos de una sesión.
     */
    public async findActiveParticipants(sesionId: string): Promise<ParticipantWithUser[]> {
        return await this.client.participanteSesion.findMany({
            where: {
                sesionId,
                activo: true,
            },
            include: {
                usuario: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    /**
     * Busca un participante específico dentro de una sesión.
     */
    public async findParticipant(sesionId: string, usuarioId: string): Promise<ParticipanteSesion | null> {
        return await this.client.participanteSesion.findUnique({
            where: {
                usuarioId_sesionId: {
                    usuarioId,
                    sesionId,
                },
            },
        });
    }

    /**
     * Actualiza el estado activo de un participante en una sesión.
     */
    public async setParticipantActiveStatus(
        sesionId: string,
        usuarioId: string,
        activo: boolean
    ): Promise<ParticipanteSesion | null> {
        const existing = await this.findParticipant(sesionId, usuarioId);
        if (!existing) {
            return null;
        }
        return await this.client.participanteSesion.update({
            where: {
                usuarioId_sesionId: {
                    usuarioId,
                    sesionId,
                },
            },
            data: { activo },
        });
    }

    /**
     * Ejecuta una transacción atómica para validar el límite estricto de 4 usuarios activos
     * y registrar o actualizar al participante como activo = true.
     */
    public async joinSessionTransaction(sesionId: string, usuarioId: string): Promise<JoinSessionResult> {
        return await this.client.$transaction(async (tx) => {
            const session = await tx.sesionColaborativa.findUnique({
                where: { id: sesionId },
            });

            if (!session || session.estado !== EstadoSesion.ACTIVA) {
                throw new AppException('NOT_FOUND');
            }

            const activeCount = await tx.participanteSesion.count({
                where: {
                    sesionId,
                    activo: true,
                },
            });

            if (activeCount >= MAX_ACTIVE_PARTICIPANTS) {
                throw new AppException('SESSION_FULL');
            }

            const defaultRole =
                session.propietarioId === usuarioId
                    ? RolParticipante.PROPIETARIO
                    : RolParticipante.COLABORADOR;

            const participant = await tx.participanteSesion.upsert({
                where: {
                    usuarioId_sesionId: {
                        usuarioId,
                        sesionId,
                    },
                },
                update: {
                    activo: true,
                },
                create: {
                    sesionId,
                    usuarioId,
                    rol: defaultRole,
                    activo: true,
                },
            });

            const participants = await tx.participanteSesion.findMany({
                where: {
                    sesionId,
                    activo: true,
                },
                include: {
                    usuario: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                },
            });

            return {
                session,
                participant,
                participants,
            };
        });
    }
}
