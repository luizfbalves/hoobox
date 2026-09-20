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
        'src/modules/orders/order-total.ts',
        'src/modules/orders/processing-delay.ts',
        'src/modules/orders/order-queue-options.ts',
        'src/modules/orders/order-created.processor.ts',
        'src/modules/orders/orders.service.ts',
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
