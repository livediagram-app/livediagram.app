import { defineProject } from '@liveworkspace/vitest-config';

// Held at what the package's own tests reach (measured 2026-11-10: 33.7% statements, 31.6% branches, 41.3% functions,
// 34.4% lines). The products' own tests of these modules still run through their bindings and count there; each test
// that moves here raises the floor, which may only go up.
export default defineProject({
  test: {
    coverage: {
      thresholds: { statements: 33, branches: 31, functions: 41, lines: 34 },
    },
  },
});
