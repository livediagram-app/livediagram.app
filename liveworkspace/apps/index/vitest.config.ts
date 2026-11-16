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
      // A floor just under what the service measures today (96.6 statements, 93.4 branches, 98.8 functions, 98.8 lines
      // on 2026-11-16), so a change that leaves new code untested turns CI red; raise it as the gaps close.
      thresholds: { statements: 96, branches: 93, functions: 98, lines: 98 },
    },
  },
});
