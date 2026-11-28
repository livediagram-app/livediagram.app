import { defineProject } from '@liveworkspace/vitest-config';

// Every app's chat app checks its requests with this package (liveworkspace/docs/specs/023-chat-apps): every line
// and branch is covered.
export default defineProject({
  test: {
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/index.ts', 'src/test-keys.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
