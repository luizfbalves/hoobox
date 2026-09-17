export const MAX_CENTS = 2_147_483_647;

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
