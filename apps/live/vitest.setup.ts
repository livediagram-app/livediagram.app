import { afterEach } from 'vitest';

// Unmount every React root between tests.
//
// Testing Library registers this itself — but only when Vitest runs with
// `globals: true`, and this repo runs with explicit imports (see
// packages/vitest-config). So nothing unmounted, and a file that rendered a
// hook without calling `unmount()` left a live root behind. React keeps
// scheduled work on that root, the scheduler wakes on a later macrotask, and
// if the file has finished by then Vitest has already torn the jsdom
// environment down: `ReferenceError: window is not defined`, raised as an
// unhandled error that fails the whole run with every test still passing.
// It needs a slow machine to land, so it reads as CI-only flake.
//
// Guarded because `environment: 'node'` is the default here and only a
// handful of files opt into jsdom with a docblock; importing Testing Library
// into a DOM-less file would break the other ~1,900 tests.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
