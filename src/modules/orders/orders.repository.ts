import { OrderStatus } from "../../generated/prisma/enums.js";
import { CreateOrderDto } from "../dtos/create-order.dto.js"

export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY')

export type OrderRecord = {
    id: number;
    customerId: number;
    totalCents: number;
    total: string;
    status: OrderStatus;
};

export interface OrdersRepository {
    createWithItems(input: CreateOrderDto): Promise<OrderRecord>
}
