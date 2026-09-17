import { Injectable } from "@nestjs/common";
import { CreateOrderDto } from "../dtos/create-order.dto.js";

@Injectable()
export class OrdersService {
    constructor() {}

    public createOrder (props: CreateOrderDto) {
        const {customerName, items} = props

        console.log({customerName, items})
    }

}