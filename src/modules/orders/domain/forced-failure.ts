// Gatilho do cenário de falha pedido no teste técnico.
export function shouldSimulateFailure(customerName: string): boolean {
  return customerName.toLowerCase().includes('fail');
}
