import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CreateOrderDto } from "../dtos/create-order.dto.js";
import { ListOrdersQueryDto } from "../dtos/list-orders-query.dto.js";
import { OrdersService } from "./orders.service.js";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  listOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(query);
  }

  @Get(":id")
  getOrder(@Param("id", ParseIntPipe) id: number) {
    return this.ordersService.getOrderById(id);
  }

  @Post()
  async createOrder(@Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(body);
  }
}
