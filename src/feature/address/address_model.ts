import { Address } from '@prisma/client';

export function toAddressApi(address: AddressDomain): AddressApi {
    return {
        id: address.id,
        street: address.street,
        internalNumber: address.internalNumber || undefined,
        externalNumber: address.externalNumber || undefined,
        neighborhood: address.neighborhood,
        locality: address.locality,
        municipality: address.municipality,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
    };
}

export function toAddressDomain(address: AddressApi): AddressDomain {
    return {
        id: address.id,
        street: address.street,
        internalNumber: address.internalNumber || '',
        externalNumber: address.externalNumber || '',
        neighborhood: address.neighborhood,
        locality: address.locality,
        municipality: address.municipality,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export function addressToAddressDomain(address: Address): AddressDomain {
    return {
        id: address.id,
        street: address.street,
        internalNumber: address.internalNumber || '',
        externalNumber: address.externalNumber || '',
        neighborhood: address.neighborhood,
        locality: address.locality,
        municipality: address.municipality,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export function toAddress(address: AddressDomain): Address {
    return {
        id: address.id || '',
        street: address.street,
        internalNumber: address.internalNumber,
        externalNumber: address.externalNumber,
        neighborhood: address.neighborhood,
        locality: address.locality,
        municipality: address.municipality,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt,
    };
}

export interface AddressDomain {
    id?             :string,
    street          :string,
    internalNumber  :string,
    externalNumber  :string,
    neighborhood    :string,
    locality        :string,
    municipality    :string,
    state           :string,
    zipCode         :string,
    country         :string,
    createdAt       :Date,
    updatedAt       :Date,
}

export interface AddressApi {
    id?             :string,
    street          :string,
    internalNumber? :string,
    externalNumber? :string,
    neighborhood    :string,
    locality        :string,
    municipality    :string,
    state           :string,
    zipCode         :string,
    country         :string,
}