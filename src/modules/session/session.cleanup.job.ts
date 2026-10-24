import cron, { ScheduledTask, TaskOptions } from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../core/config/database_manage';
import { LoggerManage } from '../../core/config/logger';

export const DAILY_MIDNIGHT_CRON = '0 0 * * *';
export const INVALID_SESSION_RETENTION_DAYS = 7;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SessionCleanupResult {
    deletedCount: number;
    executedAt: Date;
    invalidCutoffDate: Date;
}

/**
 * HU-24: Limpieza Automática de Sesiones e Invalidation (Job Programado)
 * Ejecuta diariamente a medianoche la purga física (DELETE) de registros obsoletos
 * en la tabla SesionUsuario sin bloquear el Event Loop de Node.js.
 */
export class SessionCleanupJob {
    private client: PrismaClient;
    private cronExpression: string;
    private task: ScheduledTask | null = null;

    constructor(
        client: PrismaClient = defaultPrisma,
        cronExpression: string = DAILY_MIDNIGHT_CRON
    ) {
        this.client = client;
        this.cronExpression = cronExpression;
    }

    /**
     * Valida que la expresión cron configurada sea sintácticamente válida.
     */
    public isValidCronExpression(expression: string = this.cronExpression): boolean {
        return cron.validate(expression);
    }

    /**
     * Obtiene la expresión cron configurada para el job.
     */
    public getCronExpression(): string {
        return this.cronExpression;
    }

    /**
     * Calcula la fecha límite de antigüedad (7 días atrás desde la fecha de referencia).
     */
    public static getInvalidSessionCutoffDate(referenceDate: Date = new Date()): Date {
        return new Date(referenceDate.getTime() - INVALID_SESSION_RETENTION_DAYS * MS_PER_DAY);
    }

    /**
     * Ejecuta la consulta asíncrona en Prisma para eliminar registros de SesionUsuario donde:
     * - expiresAt < NOW()
     * - O (isValid == false Y tienen más de 7 días de antigüedad en updatedAt o createdAt)
     */
    public async executeCleanup(referenceDate: Date = new Date()): Promise<SessionCleanupResult> {
        const invalidCutoffDate = SessionCleanupJob.getInvalidSessionCutoffDate(referenceDate);

        try {
            const result = await this.client.sesionUsuario.deleteMany({
                where: {
                    OR: [
                        {
                            expiresAt: {
                                lt: referenceDate,
                            },
                        },
                        {
                            isValid: false,
                            OR: [
                                {
                                    updatedAt: {
                                        lt: invalidCutoffDate,
                                    },
                                },
                                {
                                    createdAt: {
                                        lt: invalidCutoffDate,
                                    },
                                },
                            ],
                        },
                    ],
                },
            });

            const cleanupResult: SessionCleanupResult = {
                deletedCount: result.count,
                executedAt: referenceDate,
                invalidCutoffDate,
            };

            LoggerManage.info('Limpieza automática de sesiones completada exitosamente', {
                job: 'SessionCleanupJob',
                deletedCount: cleanupResult.deletedCount,
                executedAt: cleanupResult.executedAt.toISOString(),
                invalidCutoffDate: cleanupResult.invalidCutoffDate.toISOString(),
            });

            return cleanupResult;
        } catch (error) {
            LoggerManage.error('Error durante la limpieza automática de sesiones (DB Connection Error)', {
                job: 'SessionCleanupJob',
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Inicia el job programado diariamente a medianoche ('0 0 * * *').
     * Utiliza noOverlap y unref para no bloquear el Event Loop ni impedir el cierre limpio del proceso.
     */
    public start(options?: TaskOptions): ScheduledTask {
        if (!this.isValidCronExpression(this.cronExpression)) {
            throw new Error(`Invalid cron expression for SessionCleanupJob: ${this.cronExpression}`);
        }

        if (this.task) {
            return this.task;
        }

        this.task = cron.schedule(
            this.cronExpression,
            async () => {
                try {
                    await this.executeCleanup(new Date());
                } catch {
                    // El error ya es registrado en LoggerManage dentro de executeCleanup
                }
            },
            {
                name: 'session-cleanup-midnight-job',
                noOverlap: true,
                unref: true,
                ...options,
            }
        );

        LoggerManage.info('Job programado de limpieza de sesiones registrado', {
            job: 'SessionCleanupJob',
            cronExpression: this.cronExpression,
        });

        return this.task;
    }

    /**
     * Detiene y limpia la tarea programada si se encuentra activa.
     */
    public stop(): void {
        if (this.task) {
            this.task.stop();
            this.task = null;
        }
    }

    /**
     * Devuelve la instancia actual de la tarea programada.
     */
    public getTask(): ScheduledTask | null {
        return this.task;
    }
}

export const sessionCleanupJob = new SessionCleanupJob();
