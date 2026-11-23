import { defineConfig } from 'vitest/config';
import { UNDER_COVERAGE_ENV } from '@liveworkspace/vitest-config/cpu-time';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // A coverage run tells its workers so, and speed tests leave their CPU budgets to the plain rerun
    // (`vitest-budgets` in `test:coverage`), as the shared config does (docs/ci.md "Speed budgets").
    env: process.argv.includes('--coverage') ? { [UNDER_COVERAGE_ENV]: '1' } : {},
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
