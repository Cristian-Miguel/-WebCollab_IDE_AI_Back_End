import { PrismaClient, SesionColaborativa, RolParticipante, EstadoSesion } from '@prisma/client';
import { prisma } from '../../core/config/database_manage';

export interface CreateSessionData {
    nombre: string;
    descripcion?: string;
    propietarioId: string;
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
                participantes: true,
                archivoProyecto: true,
            },
        });
    }
}
