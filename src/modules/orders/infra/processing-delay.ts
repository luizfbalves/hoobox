export function resolveProcessingDelayMs(): number {
  const fromEnv = process.env.ORDER_PROCESSING_DELAY_MS;
  if (fromEnv !== undefined && fromEnv !== '') {
    const parsed = Number(fromEnv);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 1000 + Math.random() * 1000;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
