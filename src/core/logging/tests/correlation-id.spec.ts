import { resolveCorrelationId } from '../correlation-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveCorrelationId', () => {
  it('reaproveita header válido', () => {
    expect(resolveCorrelationId('abc-123')).toBe('abc-123');
  });

  it('gera UUID quando ausente', () => {
    expect(resolveCorrelationId(undefined)).toMatch(UUID);
  });

  it('gera UUID quando vazio', () => {
    expect(resolveCorrelationId('')).toMatch(UUID);
  });

  it('gera UUID quando maior que 36 caracteres', () => {
    expect(resolveCorrelationId('a'.repeat(37))).toMatch(UUID);
  });

  it('gera UUID com caracteres fora de [A-Za-z0-9-] (log injection)', () => {
    expect(resolveCorrelationId('abc\n{"level":"fatal"}')).toMatch(UUID);
    expect(resolveCorrelationId('com espaço')).toMatch(UUID);
  });

  it('gera UUID quando header chega repetido (array)', () => {
    expect(resolveCorrelationId(['a', 'b'])).toMatch(UUID);
  });
});
