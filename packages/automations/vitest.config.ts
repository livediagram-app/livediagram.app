import { defineProject } from '@liveworkspace/vitest-config';

// The one rules engine every app's items run: every line and branch is covered.
export default defineProject({
  test: {
    coverage: {
      exclude: [
        '**/*.{test,spec}.*',
        '**/*.d.ts',
        'src/room/test-sql.ts',
        'src/room/item/test-kit.ts',
        // Tests only: what an app's real-room tests are built on.
        'src/testing/**',
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
