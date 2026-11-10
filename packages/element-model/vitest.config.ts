import { defineProject } from '@liveworkspace/vitest-config';

// Held at what the package's own tests reach (measured 2026-11-10, after part 3: 29.2% statements, 21.9% branches,
// 29.6% functions, 30.2% lines). Part 3 brought in about 10,000 lines whose tests still build their elements through
// each product's factories (createShape), so they stay in the products, run through the bindings and count there:
// the share measured here fell although the tests moved in rose. Each test that moves here raises the floor, which
// then may only go up.
export default defineProject({
  test: {
    coverage: {
      thresholds: { statements: 29, branches: 21, functions: 29, lines: 30 },
    },
  },
});
