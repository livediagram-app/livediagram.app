import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkClippedDescenders } from '@liveworkspace/style-guards/clipped-descenders';

// A line that clips its overflow never sets its line box shorter than its glyphs: `leading-none` makes the box exactly
// the font size, so `truncate` (overflow hidden) cut the descenders of g, p and y off a palette tile's name ("Cylinder"
// read "Cvlinder"). This scans every class string that clips (truncate, overflow-hidden, line-clamp) and fails one that
// also sets `leading-none` on text. Words are compared whole, split on spaces, so no pattern backtracks.
// The rule itself is every editor's (packages/style-guards/src/clipped-descenders.ts); this runs it over this editor's folders.

const ROOT = fileURLToPath(new URL('./', import.meta.url));
// The editor code every editor shares (@liveworkspace/workbench) renders here too.
const DIRS = ['components', 'app', 'hooks', '../../../packages/workbench/src'];

describe('clipped descenders', () => {
  it('never clips a line of text whose line box is shorter than its glyphs', () => {
    expect(checkClippedDescenders({ root: ROOT, dirs: DIRS })).toEqual([]);
  });
});
