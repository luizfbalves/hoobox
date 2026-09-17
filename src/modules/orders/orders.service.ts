import { Inject, Injectable } from "@nestjs/common";
import { CreateOrderDto } from "../dtos/create-order.dto.js";
import {
    ORDERS_REPOSITORY,
    type OrdersRepository,
} from "./orders.repository.js";

@Injectable()
export class OrdersService {
    constructor(
        @Inject(ORDERS_REPOSITORY)
        private readonly ordersRepository: OrdersRepository,
    ) {}

    public createOrder(props: CreateOrderDto) {
        return this.ordersRepository.createWithItems(props);
    }
}