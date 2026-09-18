import { OrderStatus } from "../../generated/prisma/enums.js";
import { CreateOrderDto } from "../dtos/create-order.dto.js";

export const ORDERS_REPOSITORY = Symbol("ORDERS_REPOSITORY");

export type OrderRecord = {
  id: number;
  customerId: number;
  totalCents: number;
  total: string;
  status: OrderStatus;
};

export type OrderItemRecord = {
  productName: string;
  quantity: number;
  priceCents: number;
  price: string;
};

export type OrderSummaryRecord = OrderRecord & {
  customerName: string;
  failureReason: string | null;
  createdAt: Date;
};

export type OrderDetailRecord = OrderSummaryRecord & {
  items: OrderItemRecord[];
};

export type PaginatedOrders = {
  data: OrderDetailRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export interface OrdersRepository {
  createWithItems(input: CreateOrderDto): Promise<OrderRecord>;
  processCreatedOrder(orderId: number): Promise<void>;
  findById(id: number): Promise<OrderDetailRecord>;
  findMany(page: number, limit: number): Promise<PaginatedOrders>;
  markFailed(orderId: number, reason: string): Promise<void>;
}
