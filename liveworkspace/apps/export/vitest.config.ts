import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // The Worker's entry and the object's class are workerd's to run: their logic lives in the modules beside them,
      // each tested in node.
      exclude: [
        '**/*.test.ts',
        'src/test-support.ts',
        'src/index.ts',
        'src/job/durable-object.ts',
        'src/picture.ts',
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
