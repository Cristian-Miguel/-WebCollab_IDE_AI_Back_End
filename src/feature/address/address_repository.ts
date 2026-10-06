import { PrismaClient, User, RevokedToken, Address, Role, ROLE_TYPE, Prisma } from '@prisma/client';
import { DatabaseManage } from '../../core/config/database_manage';
import { DBException } from '../../core/exception/db_exception';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AddressApi, AddressDomain } from './address_model';

export class AddressRepository {
    private prisma: PrismaClient;
    
    constructor() {
        this.prisma = DatabaseManage.getInstance();
    }

    public async createAddress(addressData: AddressDomain, tx: Prisma.TransactionClient): Promise<Address> {
        try {
            const result: Address = await tx.address.create({
                data: {
                    street: addressData.street,
                    internalNumber: addressData.internalNumber,
                    externalNumber: addressData.externalNumber,
                    neighborhood: addressData.neighborhood,
                    locality: addressData.locality,
                    municipality: addressData.municipality,
                    state: addressData.state,
                    zipCode: addressData.zipCode,
                    country: addressData.country,
                },
            });
            
            return result;
        } catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, error.message);
            }
            throw error;
        }
    }

    public async updateAddress(addressId: string, addressData: AddressDomain, tx: Prisma.TransactionClient): Promise<Address> {
        try {
            const updatedAddress = await tx.address.update({
                where: { id: addressId },
                data: {
                    street: addressData.street,
                    internalNumber: addressData.internalNumber,
                    externalNumber: addressData.externalNumber,
                    neighborhood: addressData.neighborhood,
                    locality: addressData.locality,
                    municipality: addressData.municipality,
                    state: addressData.state,
                    zipCode: addressData.zipCode,
                    country: addressData.country,
                },
            });
            return updatedAddress;
        }
        catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, error.message);
            }
            throw error;
        }
    }

    public async getAddressById(addressId: string): Promise<Address | null> {
        try {
            const address = await this.prisma.address.findUnique({
                where: { id: addressId },
            });
            return address;
        }
        catch (error) {
            if (error instanceof PrismaClientKnownRequestError) {
                throw new DBException(error, error.message);
            }
            throw error;
        }
    }
}
