import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The Workers runtime's own module, which node has not: the Durable Object base class the workbench store extends
  // (@liveworkspace/api-kit's testing/cloudflare-workers.ts), so a test can reach the Worker's own fetch.
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
    include: ['{src,scripts}/**/*.test.ts'],
  },
});
