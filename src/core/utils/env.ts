export function readNonNegativeNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function readPositiveNumberEnv(name: string, fallback: number): number {
  const value = readNonNegativeNumberEnv(name, fallback);
  return value > 0 ? value : fallback;
}
