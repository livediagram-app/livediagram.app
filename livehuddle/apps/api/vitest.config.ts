import { fileURLToPath } from 'node:url';
import { defineProject } from '@liveworkspace/vitest-config';

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
  'src/db/api-tokens.ts',
  'src/routes/share.ts',
  'src/routes/tokens.ts',
  // Who a room session is (the person the worker verified for it).
  'src/room-session.ts',
  // The image reference index and the sweep that trusts it: a gap here
  // deletes a picture someone placed (docs/specs/009-elements/images.md).
  'src/image-refs/**',
  'src/db/image-refs.ts',
  // Which documents may serve an image they don't own ("Placement grants").
  'src/db/image-grants.ts',
  // Proximity audio's mint route: who may mint a Realtime session, publish a microphone or subscribe to one
  // (docs/specs/012-collaboration/proximity-audio.md "The mint route").
  'src/calls/**',
  'src/routes/calls.ts',
  // The walkers' rules on the presence relay (docs/specs/015-api/api.md "A busy room bounds its presence fan-out"),
  // held at 100% as they were while they were shared in @liveworkspace/api-kit: a gap sends a character to a tab
  // that cannot see it, or an older editor a lean packet it cannot draw.
  'src/room-avatar-track.ts',
];

export default defineProject({
  // The Workers runtime's own module, which node has not: the Durable Object base class the document's room
  // extends (@liveworkspace/api-kit's testing/cloudflare-workers.ts).
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
