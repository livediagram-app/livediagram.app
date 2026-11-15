import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The Workers runtime's own module, which node has not: the Durable Object base class the webhook dispatcher
  // extends (@liveworkspace/api-kit's testing/cloudflare-workers.ts), so a test can reach the Worker's entry.
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('../../../packages/api-kit/src/testing/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      // A floor just under what the service measures today (95.2 statements, 92.0 branches, 97.0 functions,
      // 98.0 lines on 2026-11-15), so a change that leaves new code untested turns CI red; raise it as the gaps close.
      thresholds: { statements: 94, branches: 91, functions: 96, lines: 97 },
    },
  },
});
