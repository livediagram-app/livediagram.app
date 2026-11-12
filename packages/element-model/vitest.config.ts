import { defineProject } from '@liveworkspace/vitest-config';

// Held at what the package's own tests reach (measured 2026-11-12, after part 6, the flowchart: 67.0% statements,
// 59.1% branches, 67.8% functions, 68.5% lines). Part 4's product-neutral builders
// (src/testing/elements.ts) let the products' tests of the moved modules move here; a product's test that reads its
// own validator or renderer stays in the product and runs through the bindings. Each test that moves here raises the
// floor, which then may only go up.
export default defineProject({
  test: {
    coverage: {
      thresholds: { statements: 67, branches: 59, functions: 67, lines: 68 },
    },
  },
});
