export function aggregateQuantitiesByProduct(
  items: Array<{ productId: number; quantity: number }>,
): Array<[productId: number, quantity: number]> {
  const totals = new Map<number, number>();
  for (const item of items) {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }
  return [...totals.entries()].sort(([a], [b]) => a - b);
}
