import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { OrderRecord, OrdersRepository } from "./orders.repository.js";

import { CreateOrderDto } from "../dtos/create-order.dto.js";
import {
    formatCents,
    MAX_CENTS,
    toCents,
} from "../../core/utils/money.js";
import { PrismaService } from "../../core/prisma/prisma.service.js";

@Injectable()
export class PrismaOrdersRepository implements OrdersRepository {
    constructor(private readonly prisma: PrismaService) {}

    async createWithItems(input: CreateOrderDto): Promise<OrderRecord> {
        const items = input.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            priceCents: toCents(item.price),
        }));

        return this.prisma.$transaction(async (tx) => {
            let customer = await tx.customer.findFirst({
                where: { name: input.customerName },
            });
            if (!customer) {
                customer = await tx.customer.create({
                    data: { name: input.customerName },
                });
            }

            const productNames = [...new Set(items.map((item) => item.productName))];
            const products = await tx.product.findMany({
                where: { name: { in: productNames } },
            });

            const productByName = new Map(
                products.map((product) => [product.name, product]),
            );

            const missing = productNames.filter((name) => !productByName.has(name));
            if (missing.length > 0) {
                throw new NotFoundException(
                    `Produto(s) não encontrado(s): ${missing.join(", ")}`,
                );
            }

            const totalCents = items.reduce(
                (sum, item) => sum + item.quantity * item.priceCents,
                0,
            );

            if (totalCents > MAX_CENTS) {
                throw new BadRequestException(
                    "Total do pedido excede o valor máximo permitido",
                );
            }

            const order = await tx.order.create({
                data: {
                    customerId: customer.id,
                    totalCents,
                    items: {
                        create: items.map((item) => ({
                            productId: productByName.get(item.productName)!.id,
                            quantity: item.quantity,
                            priceCents: item.priceCents,
                        })),
                    },
                },
            });

            return {
                id: order.id,
                customerId: order.customerId,
                totalCents: order.totalCents,
                total: formatCents(order.totalCents),
                status: order.status,
            };
        });
    }
}
