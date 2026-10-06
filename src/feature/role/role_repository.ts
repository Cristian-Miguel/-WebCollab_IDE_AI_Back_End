import { PrismaClient, User, RevokedToken, Role, ROLE_TYPE } from '@prisma/client';
import { DatabaseManage } from '../../core/config/database_manage';
import { DBException } from '../../core/exception/db_exception';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { RoleDomain } from './role_model';

export class RoleRepository {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = DatabaseManage.getInstance();
    }

    public async createRole(roleData: RoleDomain): Promise<Role> {
        try {
            const newRole = await this.prisma.role.create({
                data: {
                    name: this.getRoleTypeEnum(roleData.name),
                    description: roleData.description,
                    isActive: roleData.isActive,
                },
            });
            return newRole;
        }
        catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, error.message);
            }
            throw error;
        }
    }

    public async getRoleByName(roleName: string): Promise<Role> {
        try {
            const roleEnum: ROLE_TYPE = this.getRoleTypeEnum(roleName);

            const role: Role = await this.prisma.role.findFirstOrThrow({
                where:{ name: roleEnum }
            });
            return role;
        }
        catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, error.message);
            }
            throw error;
        }
    }

    public getRoleTypeEnum(name: string): ROLE_TYPE {
        const rolesValores: ROLE_TYPE[] = Object.values(ROLE_TYPE);
        let rolEnumName = name.toUpperCase() as ROLE_TYPE;
        rolesValores.forEach(rolEnum => {
            if(rolEnum === ROLE_TYPE.ADMINISTRATOR && rolEnum === name.toUpperCase()) {
                rolEnumName = ROLE_TYPE.ADMINISTRATOR;
            } else if(rolEnum === ROLE_TYPE.SUPPORT && rolEnum === name.toUpperCase()) {
                rolEnumName = ROLE_TYPE.SUPPORT;
            } else {
                rolEnumName = ROLE_TYPE.CUSTOMER;
            }
        });
        return rolEnumName;
    }
}