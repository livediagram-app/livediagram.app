import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkCountBadges } from '@liveworkspace/style-guards/count-badges';

// Counts are badges (docs/specs/004-interface-design/counts.md): a UI string never puts a count in
// brackets ("Reveal (3)", "Gallery (12)"). This scans the editor's sources for
// a bracketed interpolation (after a space, as in prose; a CSS call like
// `brightness(${n})` has none) of something that counts (`.length`, `count`,
// `total`), outside accessible labels, which spell counts out for a screen
// reader, and outside tests.
// The rule itself is every editor's (packages/style-guards/src/count-badges.ts); this runs it over this editor's folders.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  'app',
  'components',
  'hooks',
  'lib',
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  '../../../packages/workbench/src',
  // Avatar mode's code (@livehuddle/avatar) renders here too.
  '../../packages/avatar/src',
];

describe('counts are badges', () => {
  it('puts no count in brackets in a UI string', () => {
    expect(checkCountBadges({ root: ROOT, dirs: DIRS })).toEqual([]);
  });
});
