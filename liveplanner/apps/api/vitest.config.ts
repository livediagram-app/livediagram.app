import { fileURLToPath } from 'node:url';
import { defineProject } from '@liveworkspace/vitest-config';

// The identity, token and share-link modules are held at 100% — not as a
// coverage vanity number, but because they are the only code in the repo that
// answers "who is this caller" and "may they open this project". Everything
// else in the worker fails visibly; these fail by serving the right response
// to the wrong person, which no amount of production monitoring notices.
//
// Per-glob thresholds, so the bar applies file by file: a new module dropped
// into src/auth/ is held to the same standard on the commit that adds it,
// rather than being averaged away by its neighbours. The rest of the worker
// has no threshold yet (docs/specs/003-system-architecture/testing.md) — this is the first ratchet, not the last.
const GATE_KEEPERS = [
  'src/auth/**',
  'src/db/api-tokens.ts',
  'src/db/share.ts',
  'src/db/shared.ts',
  'src/db/ws-tickets.ts',
  'src/routes/share.ts',
  'src/routes/shared.ts',
  'src/routes/tokens.ts',
  'src/routes/project-share-routes.ts',
  'src/db/project-removal.ts',
];

export default defineProject({
  // The Workers runtime's own module, which node has not: the Durable Object base class the plan's room extends
  // (@liveworkspace/api-kit's testing/cloudflare-workers.ts).
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('../../../packages/api-kit/src/testing/cloudflare-workers.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      thresholds: Object.fromEntries(
        GATE_KEEPERS.map((glob) => [
          glob,
          { statements: 100, branches: 100, functions: 100, lines: 100 },
        ]),
      ),
    },
  },
});
