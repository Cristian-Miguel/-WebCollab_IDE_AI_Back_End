import { Prisma, PrismaClient } from "@prisma/client";
import { DatabaseManage } from "../../core/config/database_manage";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
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
            if (error instanceof PrismaClientKnownRequestError) {
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
            if (error instanceof PrismaClientKnownRequestError) {
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
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, 'Error al guardar el token bloqueado');
            }
            throw error;
        }
    }
}