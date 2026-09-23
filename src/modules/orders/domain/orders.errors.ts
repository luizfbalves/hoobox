export class InsufficientStockError extends Error {
  constructor() {
    super('estoque insuficiente');
    this.name = 'InsufficientStockError';
  }
}

export class ForcedProcessingError extends Error {
  constructor(message = 'falha simulada no processamento') {
    super(message);
    this.name = 'ForcedProcessingError';
  }
}
