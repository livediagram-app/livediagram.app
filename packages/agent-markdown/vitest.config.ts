import { defineProject } from '@liveworkspace/vitest-config';

// The negotiation, the conversion and the build's planning are pure and fully covered
// (liveworkspace/docs/specs/010-site/markdown-for-agents.md "Tests"); scripts/ is IO, proven by every site's build
// running it for real.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'scripts/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
