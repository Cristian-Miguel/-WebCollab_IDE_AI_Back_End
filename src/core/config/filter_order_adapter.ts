import { FILTER_OPERADOR } from '../const/filter_operador';
import { ORDER_OPERATOR } from '../const/order_operator';
import { AppException } from '../exception/app_exception';
import { prisma } from './database_manage';

export interface Paginate {
    filterBy?: Filter[],
    orderBy?: Order,
    page: number,
    limit: number
}

export interface Filter{
    value: string | number | boolean,
    field: string, 
    operator: FILTER_OPERADOR
}

export interface Order{
    field: string,
    operator: ORDER_OPERATOR
}

/**
 * * Handle to build the filter or order in prisma format.
 *  Provides methods to build the filter and order in prisma format. 
 * @class FilterOrOrderDataHandle
 */
export class FilterOrderAdapter {

    /**
     * Function to transform filter array to prisma format.
     * 
     * @param {<T extends Record<string, any>>} validFields - Fields allowed to filter.
     * @param {Filter[]} filter - filter format to get by api.
     * @returns {object} - The filter object build in prisma format.
     * @throws Will throw a AppException if filter build fails.
     */
    public static async buildFilter (filter: Filter[], validFields: string[]) {
        const chooseFilterTypeFormat = (filterField: string, filterOperator: FILTER_OPERADOR, compare: any, isNested: boolean) => {
            const nestedField: string[] = filterField.split('.')

            const baseObj = isNested
                // ? { [Object.keys(filterField)[0]]: { [Object.values(filterField)[0]]: {[filterOperator]: compare} } }
                ? { 
                    [nestedField[0]]: { 
                        [nestedField[1]]: {
                            [filterOperator]: compare
                        } 
                    } 
                } 
                : { [filterField]: {[filterOperator]: compare} };
            
            return baseObj;
        };

        const prismaFilter = filter.reduce((acc: any, { field, value, operator }) => {
            let isNested: boolean = false;
            let prismaField:string = '';

            for(let validField in validFields) {
                if(validField === field) {
                    prismaField = validField
                    const size = validField.split('.').length
                    isNested = (size > 1)
                    break;
                }
            }

            if (!validFields) {
                throw new AppException('FILTER_FIELD_ERROR');
            }
    
            switch (operator) {
                case FILTER_OPERADOR.CONTAINS:
                    if (typeof value === 'number') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.EQUALS:
                    if (typeof value !== 'number' || typeof value !== 'string' || typeof value !== 'bigint' 
                        || typeof value !== 'boolean'
                        ) {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.GREATER_THAN:
                    if (typeof value !== 'number' || typeof value !== 'bigint') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.LESS_THAN:
                    if (typeof value !== 'number' || typeof value !== 'bigint') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.GREATER_THAN_OR_EQUAL:
                    if (typeof value !== 'number' || typeof value !== 'bigint') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.LESS_THAN_OR_EQUAL:
                    if (typeof value !== 'number' || typeof value !== 'bigint') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.BETWEEN:
                    if (typeof value !== 'number' || typeof value !== 'string' || typeof value !== 'bigint') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.ENDS_WITH:
                    if (typeof value !== 'string') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.STARTS_WITH:
                    if (typeof value !== 'string') {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.IN:
                    if (typeof value !== 'number' || typeof value !== 'string' || typeof value !== 'bigint' 
                        || typeof value !== 'boolean'
                        ) {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                case FILTER_OPERADOR.NOT_IN:
                    if (typeof value !== 'number' || typeof value !== 'string' || typeof value !== 'bigint' 
                        || typeof value !== 'boolean'
                        ) {
                        throw new AppException('FILTER_OPERATOR_ERROR');
                    }
                    break;
                default:
                    throw new AppException('FILTER_OPERATOR_ERROR');
            }

            acc.push(chooseFilterTypeFormat(prismaField, operator, value, isNested));
            
            return acc;
        }, []);

        const filterAdapter = {
            AND: prismaFilter
        }
        
        return filterAdapter;
    }

    /**
     * Function to transform orderBy array to prisma format.
     * 
     * @param {object} validFields - Fields allowed to filter
     * @param {array} orderBy - orderBy format to get by api
     * @returns {object} - The orderBy object build in prisma format.
     * @throws Will throw a orderByError if orderBy build fails.
     */
    public static async buildOrderBy(order: Order, validFields: string[]): Promise<Record<string, any>>{
        const { field, operator } = order;
        let prismaField: string = '';
        let isNested:boolean = false;

        for(let validField in validFields){
            if(validField === field) {
               prismaField = validField
               const size = validField.split('.').length
               isNested = (size > 1)
               break;
            }
        }

        if(!prismaField) {
            throw new AppException('ORDER_FIELD_ERROR');
        }

        if (typeof prismaField === 'string') {
            return {[prismaField]: operator};
        }

        const [relationKey, relationField] = Object.entries(prismaField)[0];

        return { [relationKey]: { [String(relationField)]: operator } };
    }

}