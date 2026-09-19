import { BadRequestException } from '@nestjs/common';
import { MAX_CENTS } from '../../../core/utils/money.js';
import {
  assertOrderTotalWithinLimit,
  calculateOrderTotalCents,
} from '../order-total.js';

describe('calculateOrderTotalCents', () => {
  it('soma várias linhas com arredondamento por item', () => {
    expect(
      calculateOrderTotalCents([
        { quantity: 2, price: 19.99 },
        { quantity: 1, price: 10.5 },
      ]),
    ).toBe(2 * 1999 + 1050);
  });

  it('aceita total exatamente em MAX_CENTS', () => {
    expect(assertOrderTotalWithinLimit(MAX_CENTS)).toBeUndefined();
  });

  it('rejeita soma que estoura inteiro seguro antes do limite', () => {
    expect(() =>
      calculateOrderTotalCents([
        { quantity: 1, price: 90_071_992_547_409.9 },
        { quantity: 1, price: 0.02 },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      calculateOrderTotalCents([
        { quantity: 1, price: 90_071_992_547_409.9 },
        { quantity: 1, price: 0.02 },
      ]),
    ).toThrow('Total do pedido excede o valor máximo permitido');
  });

  it('rejeita total acima de MAX_CENTS', () => {
    expect(() => assertOrderTotalWithinLimit(MAX_CENTS + 1)).toThrow(
      BadRequestException,
    );
    expect(() => assertOrderTotalWithinLimit(MAX_CENTS + 1)).toThrow(
      'Total do pedido excede o valor máximo permitido',
    );
  });
});
