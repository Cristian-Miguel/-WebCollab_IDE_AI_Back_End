import { PrismaClient, User, RevokedToken, Role, ROLE_TYPE } from '@prisma/client';
import { DatabaseManage } from '../../core/config/database_manage';

export class RoleService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = DatabaseManage.getInstance();
    }
}