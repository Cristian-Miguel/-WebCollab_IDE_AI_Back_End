import { Role, User } from '@prisma/client';
import { RoleDomain, RoleApi, toRoleApi, toRoleDomain, roleToRoleDomain } from '../role/role_model';

export function toUserApi(user: UserDomain, role: RoleDomain): UserApi {
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        birthDate: user.birthDate,
        profileImageUrl: user.profileImageUrl || '',
        isEmailVerified: user.isEmailVerified,
        role: toRoleApi(role),
    };
}

export function toUserDomain(user: UserApi): UserDomain {
    return {
        id: user.id ? user.id : '',
        email: user.email,
        fullName: user.fullName,
        birthDate: user.birthDate,
        profileImageUrl: user.profileImageUrl || '',
        role: toRoleDomain(user.role),
        roleId: '',
        password: '',
        isEmailVerified: false,
        isAccountLocked: false,
        loginAttempts: 0,
        lockUntil: new Date(),
        lastLogin: new Date(),
        lastLogout: new Date(),
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export function userToUserDomain(user: User, role: Role): UserDomain {
    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        birthDate: user.birthDate,
        profileImageUrl: user.profileImageUrl || '',
        role: roleToRoleDomain(role),
        roleId: user.roleId,
        password: user.password,
        isEmailVerified: user.isEmailVerified,
        isAccountLocked: user.isAccountLocked,
        loginAttempts: user.loginAttempts,
        lockUntil: user.lockUntil || new Date(),
        lastLogin: user.lastLogin || new Date(),
        lastLogout: user.lastLogout || new Date(),
        isDeleted: user.isDeleted,
        createdAt: user.registeredAt || new Date(),
        updatedAt: user.updatedAt || new Date(),
    };
}

export function toUser(user: UserDomain): User {
    return {
        id: user.id || '',
        email: user.email,
        password: user.password,
        fullName: user.fullName,
        birthDate: user.birthDate,
        profileImageUrl: user.profileImageUrl || '',
        isEmailVerified: user.isEmailVerified,
        isAccountLocked: user.isAccountLocked,
        loginAttempts: user.loginAttempts,
        lockUntil: user.lockUntil,
        lastLogin: user.lastLogin,
        lastLogout: user.lastLogout,
        isDeleted: user.isDeleted,
        registeredAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleId: user.roleId,
    };
}

export interface UserDomain {
    id?             :string,
    email           :string,
    password        :string,
    fullName        :string,
    birthDate       :Date,
    profileImageUrl?:string,
    loginAttempts   :number,
    lockUntil       :Date,
    lastLogin       :Date,
    lastLogout      :Date,
    isEmailVerified :boolean,
    isAccountLocked :boolean,
    isDeleted       :boolean,
    createdAt       :Date,
    updatedAt       :Date,
    roleId          :string,
    role            :RoleDomain,
}

export interface UserApi {
    id?              :string,
    email            :string,
    fullName         :string,
    password?        :string,
    birthDate        :Date,
    profileImageUrl? :string,
    isEmailVerified  :boolean,
    role             :RoleApi,
}
