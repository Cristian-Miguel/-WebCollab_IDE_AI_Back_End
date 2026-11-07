import { Prisma, PrismaClient } from "@prisma/client";
import { DatabaseManage } from "../../core/config/database_manage";
import { DBException } from "../../core/exception/db_exception";

export class AuthRepository {
    private prisma: PrismaClient;

    constructor(){
        this.prisma = DatabaseManage.getInstance();
    }

    public async isBlockToken(tokenHash:string){
        try {
            const found = await this.prisma.revokedToken.findUnique({
                where:{ tokenHash },
                select:{ id: true }
            });

            return found ? true : false;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                throw new DBException(error, 'Error al guardar el token bloqueado');
            }
            throw error; 
        }
    }

    public async saveBlockToken(tokenHash:string, expiresAt:Date, userId: string, tx: Prisma.TransactionClient): Promise<void>{
        try {
            await tx.revokedToken.create({
                data:{
                    tokenHash,
                    expiresAt,
                    userId, 
                }
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                throw new DBException(error, 'Error al guardar el token bloqueado');
            }
            throw error;
        }
    }

    public async expiredBlockToken(tokenHash: string, tx: Prisma.TransactionClient): Promise<void>{
        try {
            await tx.revokedToken.delete({
                where:{ tokenHash }
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                throw new DBException(error, 'Error al guardar el token bloqueado');
            }
            throw error;
        }
    }

    public async createSession(
        data: {
            id: string;
            userId: string;
            refreshTokenHash: string;
            expiresAt: Date;
            ip?: string;
            userAgent?: string;
        },
        tx?: Prisma.TransactionClient
    ): Promise<void> {
        const client = tx ?? this.prisma;
        await client.sesionUsuario.create({ data });
    }

    public async hasActiveSession(
        sessionId: string,
        userId: string,
        refreshTokenHash?: string
    ): Promise<boolean> {
        const session = await this.prisma.sesionUsuario.findFirst({
            where: {
                id: sessionId,
                userId,
                isValid: true,
                expiresAt: { gt: new Date() },
                user: { isDeleted: false },
                ...(refreshTokenHash ? { refreshTokenHash } : {}),
            },
            select: { id: true },
        });

        return session !== null;
    }

    public async invalidateSession(
        sessionId: string,
        userId: string,
        tx: Prisma.TransactionClient,
        refreshTokenHash?: string
    ): Promise<boolean> {
        const result = await tx.sesionUsuario.updateMany({
            where: {
                id: sessionId,
                userId,
                isValid: true,
                ...(refreshTokenHash ? { refreshTokenHash } : {}),
            },
            data: { isValid: false },
        });

        return result.count === 1;
    }

    public async invalidateUserSessions(
        userId: string,
        tx: Prisma.TransactionClient
    ): Promise<void> {
        await tx.sesionUsuario.updateMany({
            where: { userId, isValid: true },
            data: { isValid: false },
        });
    }
}