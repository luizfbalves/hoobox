import { BadRequestException } from '@nestjs/common';
import { MAX_CENTS, toCents } from '../../core/utils/money.js';

export type OrderLineForTotal = {
  quantity: number;
  price: number;
};

const TOTAL_OVERFLOW_MESSAGE =
  'Total do pedido excede o valor máximo permitido';

export function calculateOrderTotalCents(items: OrderLineForTotal[]): number {
  return items.reduce((sum, item) => {
    const lineCents = item.quantity * toCents(item.price);
    const next = sum + lineCents;
    if (!Number.isSafeInteger(next)) {
      throw new BadRequestException(TOTAL_OVERFLOW_MESSAGE);
    }
    return next;
  }, 0);
}

export function assertOrderTotalWithinLimit(totalCents: number): void {
  if (totalCents > MAX_CENTS) {
    throw new BadRequestException(
      'Total do pedido excede o valor máximo permitido',
    );
  }
}
