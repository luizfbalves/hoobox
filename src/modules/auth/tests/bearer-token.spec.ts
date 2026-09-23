import { extractBearerToken } from '../bearer-token.js';

describe('extractBearerToken', () => {
  it('extrai token de "Bearer <token>" sem diferenciar maiúsculas no esquema', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('retorna null para header ausente, esquema errado ou token vazio', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
  });
});
