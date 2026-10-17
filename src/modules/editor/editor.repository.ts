import { PrismaClient, ArchivoProyecto } from '@prisma/client';
import { prisma } from '../../core/config/database_manage';

export interface UpdateProjectFilesData {
    html?: string;
    css?: string;
    javascript?: string;
}

export class EditorRepository {
    private client: PrismaClient;

    constructor(client: PrismaClient = prisma) {
        this.client = client;
    }

    /**
     * Obtiene los archivos persistidos del proyecto asociados a una sesión colaborativa.
     */
    public async findBySessionId(sesionId: string): Promise<ArchivoProyecto | null> {
        return await this.client.archivoProyecto.findUnique({
            where: { sesionId },
        });
    }

    /**
     * Actualiza el contenido de los archivos HTML, CSS y JavaScript de una sesión.
     */
    public async updateBySessionId(
        sesionId: string,
        data: UpdateProjectFilesData
    ): Promise<ArchivoProyecto> {
        return await this.client.archivoProyecto.upsert({
            where: { sesionId },
            update: {
                ...(data.html !== undefined ? { html: data.html } : {}),
                ...(data.css !== undefined ? { css: data.css } : {}),
                ...(data.javascript !== undefined ? { javascript: data.javascript } : {}),
            },
            create: {
                sesionId,
                html: data.html ?? '',
                css: data.css ?? '',
                javascript: data.javascript ?? '',
            },
        });
    }
}
