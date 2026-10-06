import { Role, ROLE_TYPE } from '@prisma/client';
import { get } from 'http';

export function toRoleApi(role: RoleDomain): RoleApi {
    return {
        name: role.name,
        description: role.description,
    };
}

export function toRoleDomain(role: RoleApi): RoleDomain {
    return {
        name: role.name,
        description: role.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export function roleToRoleDomain(role: Role): RoleDomain {
    return {
        name: role.name,
        description: role.description!,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export function toRole(role: RoleDomain): Role {
    return {
        id: role.id || '',
        name: getRoleEnum(role.name),
        description: role.description,
        isActive: role.isActive,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
    };
}

function getRoleEnum(name: string): ROLE_TYPE {
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



export interface RoleDomain {
    id?         :string,
    name        :string,
    description :string,
    isActive    :boolean,
    createdAt   :Date,
    updatedAt   :Date,
}

export interface RoleApi {
    name        :string,
    description :string,
}