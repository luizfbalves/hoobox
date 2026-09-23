import { Inject, Injectable } from '@nestjs/common';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
} from '../domain/orders.repository.js';

@Injectable()
export class OrderQueries {
  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly orders: OrdersRepository,
  ) {}

  getById(id: number) {
    return this.orders.findById(id);
  }

  list(page: number, limit: number) {
    return this.orders.findMany(page, limit);
  }
}
