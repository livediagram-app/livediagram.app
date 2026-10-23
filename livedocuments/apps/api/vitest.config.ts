import { fileURLToPath } from 'node:url';
import { defineProject } from '@livedocuments/vitest-config';

// The identity, token and share-link modules are held at 100% — not as a
// coverage vanity number, but because they are the only code in the repo that
// answers "who is this caller" and "may they open this document" (and, with
// the image reference index, "may this picture be deleted"). Everything
// else in the worker fails visibly; these fail by serving the right response
// to the wrong person, which no amount of production monitoring notices.
//
// Per-glob thresholds, so the bar applies file by file: a new module dropped
// into src/auth/ is held to the same standard on the commit that adds it,
// rather than being averaged away by its neighbours. The rest of the worker
// has no threshold yet (docs/specs/003-system-architecture/testing.md) — this is the first ratchet, not the last.
const GATE_KEEPERS = [
  'src/auth/**',
  'src/api-token-row.ts',
  'src/db/api-tokens.ts',
  'src/db/share.ts',
  'src/db/shared.ts',
  'src/db/ws-tickets.ts',
  'src/routes/share.ts',
  // Link previews name a shared document (docs/specs/013-workspace/share-link-previews.md).
  'src/routes/share-preview.ts',
  'src/routes/shared.ts',
  'src/routes/tokens.ts',
  'src/routes/document-share-routes.ts',
  // The image reference index, which the media service's sweep trusts: a gap here
  // deletes a picture someone placed (docs/specs/009-elements/images.md).
  'src/image-refs/**',
  'src/db/image-refs.ts',
  // Which documents may serve an image they don't own ("Placement grants").
  'src/db/image-grants.ts',
  'src/db/document-removal.ts',
];

export default defineProject({
  // The Workers runtime's own module, which node has not: the Durable Object base class the document's room
  // extends (src/test-cloudflare-workers.ts).
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./src/test-cloudflare-workers.ts', import.meta.url),
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
