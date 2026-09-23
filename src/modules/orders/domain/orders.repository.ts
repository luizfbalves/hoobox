import type { DomainEvent } from "../../../core/outbox/domain-event.js";
import type { OrderStatus } from "../../../generated/prisma/enums.js";

export const ORDERS_REPOSITORY = Symbol("ORDERS_REPOSITORY");

export type NewOrderDraft = {
  customerName: string;
  correlationId: string;
  totalCents: number;
  items: Array<{ productName: string; quantity: number; priceCents: number }>;
};

// Eventos dependem do id gerado no INSERT; o repositório chama dentro da transação.
export type BuildEvents = (orderId: number) => DomainEvent[];

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
  correlationId: string | null;
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
  createPending(draft: NewOrderDraft, buildEvents: BuildEvents): Promise<OrderRecord>;
  processCreatedOrder(orderId: number): Promise<void>;
  findById(id: number): Promise<OrderDetailRecord>;
  findMany(page: number, limit: number): Promise<PaginatedOrders>;
  markFailed(orderId: number, reason: string): Promise<void>;
}
