import { defineProject } from '@liveworkspace/vitest-config';

// Held at what the package's own tests reach (measured 2026-11-10: 35.2% statements, 33.3% branches, 44% functions,
// 36.1% lines). The products' own tests of these modules still run through their bindings and count there; each test
// that moves here raises the floor, which may only go up.
export default defineProject({
  test: {
    coverage: {
      thresholds: { statements: 35, branches: 33, functions: 44, lines: 36 },
    },
  },
});
