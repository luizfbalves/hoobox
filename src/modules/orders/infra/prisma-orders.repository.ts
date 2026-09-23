import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  BuildEvents,
  NewOrderDraft,
  OrderDetailRecord,
  OrderRecord,
  OrdersRepository,
  OrderSummaryRecord,
  PaginatedOrders,
  type OrderForProcessing,
  type StockReservationResult,
} from "../domain/orders.repository.js";

import { toOutboxRow } from "../../../core/outbox/domain-event.js";
import { formatCents } from "../../../core/utils/money.js";
import { PrismaService } from "../../../core/prisma/prisma.service.js";
import { OrderStatus } from "../../../generated/prisma/enums.js";
import { InsufficientStockError } from "../domain/orders.errors.js";
import { aggregateQuantitiesByProduct } from "../domain/stock-reservation.js";

type OrderWithCustomer = {
  id: number;
  customerId: number;
  totalCents: number;
  status: OrderStatus;
  failureReason: string | null;
  correlationId: string | null;
  createdAt: Date;
  customer: { name: string };
};

type OrderWithDetails = OrderWithCustomer & {
  items: Array<{
    quantity: number;
    priceCents: number;
    product: { name: string };
  }>;
};

@Injectable()
export class PrismaOrdersRepository implements OrdersRepository {
  private readonly logger = new Logger(PrismaOrdersRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPending(draft: NewOrderDraft, buildEvents: BuildEvents): Promise<OrderRecord> {
    return this.prisma.$transaction(async (tx) => {
      // INSERT ... ON DUPLICATE KEY: dois POSTs simultâneos do mesmo cliente novo não colidem no UNIQUE.
      await tx.$executeRaw`
        INSERT INTO customers (name) VALUES (${draft.customerName})
        ON DUPLICATE KEY UPDATE name = name
      `;
      const customer = await tx.customer.findUniqueOrThrow({
        where: { name: draft.customerName },
      });

      const productNames = [...new Set(draft.items.map((item) => item.productName))];
      const products = await tx.product.findMany({
        where: { name: { in: productNames } },
      });
      const productByName = new Map(products.map((product) => [product.name, product]));

      const missing = productNames.filter((name) => !productByName.has(name));
      if (missing.length > 0) {
        throw new NotFoundException(
          `Produto(s) não encontrado(s): ${missing.join(", ")}`,
        );
      }

      // Itens ordenados por productId: a checagem de FK trava produtos na mesma ordem
      // que reserveStockAndConfirm, evitando deadlock entre criação e reserva.
      const items = draft.items
        .map((item) => ({
          productId: productByName.get(item.productName)!.id,
          quantity: item.quantity,
          priceCents: item.priceCents,
        }))
        .sort((a, b) => a.productId - b.productId);

      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          totalCents: draft.totalCents,
          correlationId: draft.correlationId,
          items: { create: items },
        },
      });

      await tx.outboxEvent.createMany({
        data: buildEvents(order.id).map(toOutboxRow),
      });

      return this.toOrderRecord(order);
    });
  }

  async findById(id: number): Promise<OrderDetailRecord> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }

    return this.toDetailRecord(order);
  }

  async findMany(page: number, limit: number): Promise<PaginatedOrders> {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      }),
      this.prisma.order.count(),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data: orders.map((order) => this.toDetailRecord(order)),
      page,
      limit,
      total,
      totalPages,
    };
  }

  async markFailed(orderId: number, reason: string): Promise<void> {
    const result = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.FAILED,
        failureReason: reason.slice(0, 255),
      },
    });
    if (result.count === 0) {
      this.logger.warn(
        `markFailed sem efeito: pedido ${orderId} não está PENDING (motivo: ${reason.slice(0, 80)})`,
      );
    }
  }

  async findForProcessing(orderId: number): Promise<OrderForProcessing | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, customer: { select: { name: true } } },
    });
    return order
      ? { id: order.id, status: order.status, customerName: order.customer.name }
      : null;
  }

  // Estratégia: lock da linha do pedido (idempotência em reentrega) + UPDATE atômico
  // condicional por produto (nunca negativa, sem read-modify-write), em ordem de productId.
  async reserveStockAndConfirm(orderId: number): Promise<StockReservationResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<{ id: number }[]>`
            SELECT id FROM orders
            WHERE id = ${orderId} AND status = ${OrderStatus.PENDING}
            FOR UPDATE
          `;
          if (locked.length === 0) {
            return "NOT_PENDING" as const;
          }

          const items = await tx.orderItem.findMany({
            where: { orderId },
            select: { productId: true, quantity: true },
          });

          for (const [productId, quantity] of aggregateQuantitiesByProduct(items)) {
            const updated = await tx.product.updateMany({
              where: { id: productId, stock: { gte: quantity } },
              data: { stock: { decrement: quantity } },
            });
            if (updated.count !== 1) {
              throw new InsufficientStockError();
            }
          }

          await tx.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.PROCESSED },
          });
          return "PROCESSED" as const;
        },
        { maxWait: 10_000, timeout: 10_000 },
      );
    } catch (error) {
      // Rollback já desfez decrementos parciais de outros produtos do pedido.
      if (error instanceof InsufficientStockError) {
        return "INSUFFICIENT_STOCK";
      }
      throw error;
    }
  }

  private toOrderRecord(order: {
    id: number;
    customerId: number;
    totalCents: number;
    status: OrderStatus;
  }): OrderRecord {
    return {
      id: order.id,
      customerId: order.customerId,
      totalCents: order.totalCents,
      total: formatCents(order.totalCents),
      status: order.status,
    };
  }

  private toSummaryRecord(order: OrderWithCustomer): OrderSummaryRecord {
    return {
      ...this.toOrderRecord(order),
      customerName: order.customer.name,
      failureReason: order.failureReason,
      correlationId: order.correlationId,
      createdAt: order.createdAt,
    };
  }

  private toDetailRecord(order: OrderWithDetails): OrderDetailRecord {
    return {
      ...this.toSummaryRecord(order),
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        priceCents: item.priceCents,
        price: formatCents(item.priceCents),
      })),
    };
  }
}
