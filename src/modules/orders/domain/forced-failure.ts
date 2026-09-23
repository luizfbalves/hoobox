export function shouldSimulateFailure(customerName: string): boolean {
  return customerName.toLowerCase().includes('fail');
}
