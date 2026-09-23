export const INSUFFICIENT_STOCK_REASON = 'estoque insuficiente';

export class InsufficientStockError extends Error {
  constructor() {
    super(INSUFFICIENT_STOCK_REASON);
    this.name = 'InsufficientStockError';
  }
}

export class ForcedProcessingError extends Error {
  constructor(message = 'falha simulada no processamento') {
    super(message);
    this.name = 'ForcedProcessingError';
  }
}
