import { defineProject } from '@liveworkspace/vitest-config';

// Held at what the package's own tests reach (measured 2026-11-11, after part 5: 64.6% statements, 56.2% branches,
// 64.9% functions, 66.1% lines). Part 4's product-neutral builders
// (src/testing/elements.ts) let the products' tests of the moved modules move here; a product's test that reads its
// own validator or renderer stays in the product and runs through the bindings. Each test that moves here raises the
// floor, which then may only go up.
export default defineProject({
  test: {
    coverage: {
      thresholds: { statements: 64, branches: 56, functions: 64, lines: 66 },
    },
  },
});
