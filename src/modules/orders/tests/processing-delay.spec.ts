import { resolveProcessingDelayMs } from '../processing-delay.js';

describe('resolveProcessingDelayMs', () => {
  afterEach(() => {
    delete process.env.ORDER_PROCESSING_DELAY_MS;
  });

  it('usa env quando definida', () => {
    process.env.ORDER_PROCESSING_DELAY_MS = '0';
    expect(resolveProcessingDelayMs()).toBe(0);

    process.env.ORDER_PROCESSING_DELAY_MS = '3000';
    expect(resolveProcessingDelayMs()).toBe(3000);
  });

  it('ignora env inválida e usa delay aleatório', () => {
    process.env.ORDER_PROCESSING_DELAY_MS = 'invalid';
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(resolveProcessingDelayMs()).toBe(1000);
    spy.mockRestore();
  });

  it('usa delay aleatório 1000–2000 ms quando env ausente', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(resolveProcessingDelayMs()).toBe(1500);
    spy.mockRestore();
  });
});

describe('sleep', () => {
  it('aguarda o tempo informado', async () => {
    const { sleep } = await import('../processing-delay.js');
    const start = Date.now();
    await sleep(15);
    expect(Date.now() - start).toBeGreaterThanOrEqual(10);
  });
});
