import { readNonNegativeNumberEnv } from '../env.js';

describe('readNonNegativeNumberEnv', () => {
  afterEach(() => {
    delete process.env.TEST_NUMBER_ENV;
  });

  it('usa fallback quando ausente ou vazia', () => {
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
    process.env.TEST_NUMBER_ENV = '';
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
  });

  it('usa o valor numérico quando válido', () => {
    process.env.TEST_NUMBER_ENV = '250';
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(250);
  });

  it('usa fallback quando inválida ou negativa', () => {
    process.env.TEST_NUMBER_ENV = 'abc';
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
    process.env.TEST_NUMBER_ENV = '-1';
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
  });
});
