import { PrismaClient, Role, User, ROLE_TYPE, Prisma } from "@prisma/client";
import { DatabaseManage } from '../src/core/config/database_manage'
import { faker } from '@faker-js/faker/locale/es_MX';
import { BcryptManage } from '../src/core/config/bcript_manage';

const prisma = DatabaseManage.getInstance();
const BCRYPT_ROUNDS = 10;

async function main() {
    await prisma.$transaction(async (tx) => {
       const roles: Role[] = await createRoles(tx);
       console.log(`✅ Roles creados: ${roles.length}`);

       // Mapear roles para fácil acceso
        const roleMap = roles.reduce((map, role) => {
            map[role.name] = role;
            return map;
        }, {} as Record<ROLE_TYPE, Role>);

        // 2. Crear un Administrador
        await createSingleUser(tx, roleMap[ROLE_TYPE.ADMINISTRATOR], 'admin@example.com', 'Admin User');
        console.log('✅ Usuario Administrador creado.');

        // 3. Crear múltiples Clientes (ej. 20)
        await createBulkUsers(tx, roleMap[ROLE_TYPE.CUSTOMER], 20);
        console.log('✅ Usuarios Customer creados.');

        // 4. Crear un Usuario de Soporte
        await createSingleUser(tx, roleMap[ROLE_TYPE.SUPPORT], 'support@example.com', 'Support User');
        console.log('✅ Usuario de Soporte creado.');

    });
}

async function createRoles(tx: Prisma.TransactionClient): Promise<Role[]>{
    const roleToSave = [
        [ROLE_TYPE.ADMINISTRATOR, "Role que podra acceder a la totalidad de la aplicacion"],
        [ROLE_TYPE.SUPPORT, "Role que podra acceder a los datos de los clientes y poder manejar sus problemas"],
        [ROLE_TYPE.CUSTOMER, "Role para que cliente pueda navegar a las funciones de la aplicacion"],
    ];

    let savedRoles: Role[] = [];

    for (const [name, description] of roleToSave) {
        // Usamos upsert para evitar errores si el script se corre varias veces
        const result: Role = await tx.role.upsert({
            where: { name: name as ROLE_TYPE },
            update: { description: description as string, isActive: true },
            create: {
                name: name as ROLE_TYPE,
                description: description as string,
                isActive: true,
            },
        });
        savedRoles.push(result);
    }
    return savedRoles;
}

async function generateFakeUser(roleId: string, email?: string, fullName?: string): Promise<Omit<User, 'id' | 'registeredAt' | 'updatedAt' | 'lockUntil' | 'lastLogin' | 'lastLogout'>> {
    const plainPassword = 'password123';
    const hashedPassword = await BcryptManage.hashPassword(plainPassword);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const userFullName = fullName || `${firstName} ${lastName}`;

    return {
        email: email || faker.internet.email({ firstName, lastName }),
        password: hashedPassword,
        fullName: userFullName,
        profileImageUrl: faker.image.avatar(),
        roleId: roleId,
        birthDate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
        isEmailVerified: true,
        isAccountLocked: false,
        isDeleted: false,
        loginAttempts: 0,
    };
}

async function createSingleUser(tx: Prisma.TransactionClient, role: Role, email: string, fullName: string) {
    const userData = await generateFakeUser(role.id, email, fullName);
    await tx.user.create({ data: userData });
}

async function createBulkUsers(tx: Prisma.TransactionClient, role: Role, count: number) {
    for (let i = 0; i < count; i++) {
        const userData = await generateFakeUser(role.id);
        await tx.user.create({ data: userData });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });