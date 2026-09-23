import type { DomainEvent } from "../../../core/outbox/domain-event.js";
import type { OrderStatus } from "../../../generated/prisma/enums.js";

export const ORDERS_REPOSITORY = Symbol("ORDERS_REPOSITORY");

export type NewOrderDraft = {
  customerName: string;
  correlationId: string;
  totalCents: number;
  items: Array<{ productName: string; quantity: number; priceCents: number }>;
};

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

export type OrderForProcessing = {
  id: number;
  status: OrderStatus;
  customerName: string;
};

export type StockReservationResult = "PROCESSED" | "INSUFFICIENT_STOCK" | "NOT_PENDING";

export type RequeueResult = "REQUEUED" | "NOT_FAILED" | "NOT_FOUND";

export interface OrdersRepository {
  createPending(draft: NewOrderDraft, buildEvents: BuildEvents): Promise<OrderRecord>;
  findById(id: number): Promise<OrderDetailRecord>;
  findMany(page: number, limit: number): Promise<PaginatedOrders>;
  findForProcessing(orderId: number): Promise<OrderForProcessing | null>;
  reserveStockAndConfirm(orderId: number): Promise<StockReservationResult>;
  markFailed(orderId: number, reason: string): Promise<void>;
  requeueFailed(orderId: number, buildEvents: BuildEvents): Promise<RequeueResult>;
}
