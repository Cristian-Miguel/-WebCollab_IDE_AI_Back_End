import { SesionColaborativa } from '@prisma/client';
import { SessionRepository, CreateSessionData } from './session.repository';
import { AppException } from '../../core/exception/app_exception';

export interface CreateSessionDto {
    nombre: string;
    descripcion?: string;
}

export class SessionService {
    private sessionRepository: SessionRepository;

    constructor(sessionRepository: SessionRepository = new SessionRepository()) {
        this.sessionRepository = sessionRepository;
    }

    /**
     * Crea una nueva sesión colaborativa para un usuario autenticado.
     */
    public async createSession(dto: CreateSessionDto, userId: string): Promise<SesionColaborativa> {
        if (!userId) {
            throw new AppException('JWT_INVALID');
        }

        const data: CreateSessionData = {
            nombre: dto.nombre.trim(),
            descripcion: dto.descripcion?.trim(),
            propietarioId: userId,
        };

        return await this.sessionRepository.createSessionTransaction(data);
    }

    /**
     * Obtiene una sesión por su identificador único.
     */
    public async getSessionById(sessionId: string): Promise<SesionColaborativa> {
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
            throw new AppException('NOT_FOUND');
        }
        return session;
    }
}
