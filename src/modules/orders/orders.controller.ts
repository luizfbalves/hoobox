import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateOrderDto } from "../dtos/create-order.dto.js";
import { OrdersService } from "./orders.service.js";

@Controller('orders')
export class OrdersController {

  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getOrders() {
    return 'Hello World';
  }

  @Post()
  createOrder(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }
}