export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  options: { timeoutMs?: number; intervalMs?: number; description?: string } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await probe();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `Timeout de ${timeoutMs}ms aguardando ${options.description ?? 'condição'}`,
  );
}
