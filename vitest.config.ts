import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/modules/orders/domain/order-total.ts',
        'src/modules/orders/infra/processing-delay.ts',
        'src/modules/orders/infra/order-queue-options.ts',
        'src/modules/orders/infra/order-created.processor.ts',
        'src/modules/orders/domain/stock-reservation.ts',
        'src/modules/orders/domain/forced-failure.ts',
        'src/core/logging/correlation-id.ts',
        'src/core/utils/env.ts',
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
