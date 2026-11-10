import { defineProject } from '@liveworkspace/vitest-config';

// Held at what the package's own tests reach (measured 2026-11-10, after part 4: 56.0% statements, 47.3% branches,
// 55.5% functions, 57.6% lines). Part 4's product-neutral builders (src/testing/elements.ts) let the products' tests of
// the moved modules move here; a product's test that reads its own validator or renderer stays in the product and
// runs through the bindings. Each test that moves here raises the floor, which then may only go up.
export default defineProject({
  test: {
    coverage: {
      thresholds: { statements: 56, branches: 47, functions: 55, lines: 57 },
    },
  },
});
