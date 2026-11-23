import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkCommitUpdaterFlags } from '@liveworkspace/style-guards/commit-updater-flags';

// A handler decides before it commits (docs/specs/003-system-architecture/react-state-and-effects.md): a state
// updater may run after the call returns, so a variable it writes is not yet written when the handler reads it on the
// next line. This scans the editor's sources for a `let` that a commit's or tick's updater writes and the code after
// the call reads. It is a scan, not a parser: it looks a little before the call for the `let`, and up to the end of
// the enclosing block after it.
// The rule itself is every editor's (packages/style-guards/src/commit-updater-flags.ts); this runs it over this editor's folders.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  'app',
  'components',
  'hooks',
  'lib',
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  '../../../packages/workbench/src',
];

describe('a handler decides before it commits', () => {
  it('reads no updater-written variable after a commit, anywhere in the editor', () => {
    expect(checkCommitUpdaterFlags({ root: ROOT, dirs: DIRS })).toEqual([]);
  });
});
