import { readNonNegativeNumberEnv, readPositiveNumberEnv } from '../env.js';

describe('readNonNegativeNumberEnv', () => {
  afterEach(() => {
    delete process.env.TEST_NUMBER_ENV;
  });

  it('usa fallback quando ausente, vazia ou só com espaços', () => {
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
    process.env.TEST_NUMBER_ENV = '';
    expect(readNonNegativeNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
    process.env.TEST_NUMBER_ENV = '   ';
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

describe('readPositiveNumberEnv', () => {
  afterEach(() => {
    delete process.env.TEST_NUMBER_ENV;
  });

  it('usa o valor quando maior que zero', () => {
    process.env.TEST_NUMBER_ENV = '500';
    expect(readPositiveNumberEnv('TEST_NUMBER_ENV', 7)).toBe(500);
  });

  it('usa fallback quando zero', () => {
    process.env.TEST_NUMBER_ENV = '0';
    expect(readPositiveNumberEnv('TEST_NUMBER_ENV', 7)).toBe(7);
  });
});
