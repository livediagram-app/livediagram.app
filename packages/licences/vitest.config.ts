import { defineProject } from '@liveworkspace/vitest-config';

// The generator's logic is pure and fully covered
// (docs/specs/002-project-scope/blueprints/third-party-licences.md "Testing");
// scripts/ is IO, proven by the CI build running it for real. So are the real-install readers and the
// product table checks every @<product>/licences runs over its own tables (and the liveworkspace site over its).
export default defineProject({
  test: {
    coverage: {
      exclude: [
        '**/*.{test,spec}.*',
        '**/*.d.ts',
        'src/declared.ts',
        'src/node-reader.ts',
        'src/product-checks.ts',
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
