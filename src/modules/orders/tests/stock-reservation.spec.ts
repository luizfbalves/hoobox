import { aggregateQuantitiesByProduct } from '../domain/stock-reservation.js';
import { shouldSimulateFailure } from '../domain/forced-failure.js';

describe('aggregateQuantitiesByProduct', () => {
  it('soma itens do mesmo produto e ordena por productId (ordem de lock fixa)', () => {
    expect(
      aggregateQuantitiesByProduct([
        { productId: 9, quantity: 1 },
        { productId: 2, quantity: 3 },
        { productId: 9, quantity: 2 },
      ]),
    ).toEqual([
      [2, 3],
      [9, 3],
    ]);
  });

  it('lista vazia gera lista vazia', () => {
    expect(aggregateQuantitiesByProduct([])).toEqual([]);
  });
});

describe('shouldSimulateFailure', () => {
  it('detecta "fail" sem diferenciar maiúsculas', () => {
    expect(shouldSimulateFailure('Cliente FAIL')).toBe(true);
    expect(shouldSimulateFailure('failover')).toBe(true);
  });

  it('ignora nomes sem "fail"', () => {
    expect(shouldSimulateFailure('Ana')).toBe(false);
  });
});
