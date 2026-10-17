import { SesionColaborativa } from '@prisma/client';
import { SessionRepository, CreateSessionData, JoinSessionResult } from './session.repository';
import { SessionPresenceSocket } from './session.presence.socket';
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
     * Une a un usuario autenticado a una sesión colaborativa existente validando
     * el límite estricto de máximo 4 participantes activos (HU-06-08).
     * Emite el evento 'user_joined' con la lista actualizada de participantes.
     */
    public async joinSession(sessionId: string, userId: string): Promise<JoinSessionResult> {
        if (!userId) {
            throw new AppException('JWT_INVALID');
        }

        const result = await this.sessionRepository.joinSessionTransaction(sessionId, userId);

        // Emitir evento 'user_joined' por WebSocket con la lista actualizada de participantes
        SessionPresenceSocket.emitUserJoined(sessionId, result.participants);

        return result;
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
