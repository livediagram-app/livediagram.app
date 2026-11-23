import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDynamicBoundaries } from '@liveworkspace/style-guards/dynamic-boundary';

// Every next/dynamic import in the app must carry its own Suspense boundary.
//
// In the App Router, `dynamic()` only wraps the lazy component in a <Suspense> when
// `ssr: false` or a `loading` component is given (next/dist/shared/lib/lazy-dynamic/loadable.js:
// `hasSuspenseBoundary = !opts.ssr || !!opts.loading`, and ssr defaults to true). Without one, the
// first mount of the lazy piece suspends up to the NEAREST ancestor boundary and replaces everything
// under it until the chunk lands. For a document opened in place from /new that ancestor is the editor's
// own `dynamic(loadEditor, { loading: <DocumentLoading /> })`, so the first open of Settings or Search
// flashed the opening screen over the whole editor; in the Explorer, a pane swapped the whole layout
// for its null fallback. Every lazy piece here is client-state-gated in a static export, so
// `ssr: false` (a boundary with a null fallback) costs nothing.
// The rule itself is every editor's (packages/style-guards/src/dynamic-boundary.ts).
const ROOT = fileURLToPath(new URL('../', import.meta.url));
// The editor code every editor shares (@liveworkspace/workbench) is scanned beside this app's own.
const WORKBENCH = join(ROOT, '../../../packages/workbench/src');
// And Avatar mode's code (@livehuddle/avatar).
const AVATAR = join(ROOT, '../../packages/avatar/src');

describe('next/dynamic imports', () => {
  it('each carry their own Suspense boundary (ssr: false or a loading component)', () => {
    expect(checkDynamicBoundaries({ root: ROOT, dirs: [ROOT, WORKBENCH, AVATAR] })).toEqual([]);
  });
});
