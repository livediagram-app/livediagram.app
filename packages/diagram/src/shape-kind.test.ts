import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHAPE_KINDS } from './validate';

// The shape vocabulary exists twice: as the `ShapeKind` union in
// shape-kind.ts, and as the runtime `SHAPE_KINDS` set in validate.ts that
// guards untrusted input (the MCP server and the AI panel both hand us a
// shape name from outside). The union is compile-time only, so nothing made
// the two agree until this.
//
// Drift is silent in the direction that matters. Add a kind to the union,
// wire it through the palette, forget the Set, and `coerceShape` quietly
// returns 'square' for it — every element an AI tool or MCP client creates
// with that shape comes back a square, with no error anywhere.
//
// The union is a type, so it cannot be enumerated at runtime; the members are
// read out of the source instead, the same way the help centre's registry
// tests read page.mdx off disk.

const SRC = readFileSync(fileURLToPath(new URL('./shape-kind.ts', import.meta.url)), 'utf8');
const unionMembers = [...SRC.matchAll(/^ {2}\| '([\w-]+)'/gm)].map((m) => m[1]!);

describe('the shape vocabulary', () => {
  it('reads its members out of the source (guard against a regex gone blind)', () => {
    // If the union's formatting changes so the extraction stops matching, the
    // assertions below would pass vacuously against an empty list.
    expect(unionMembers.length).toBeGreaterThan(40);
    expect(unionMembers).toContain('square');
  });

  it('declares every kind exactly once', () => {
    expect(new Set(unionMembers).size).toBe(unionMembers.length);
  });

  it('keeps the runtime SHAPE_KINDS set in step with the ShapeKind union', () => {
    // Both directions: a kind the validator would reject, and a kind the
    // validator accepts that the type no longer knows about.
    expect([...unionMembers].filter((k) => !SHAPE_KINDS.has(k))).toEqual([]);
    expect([...SHAPE_KINDS].filter((k) => !unionMembers.includes(k))).toEqual([]);
  });

  // spec/09-canvas-and-palette.md cites this number in its prose. Themes and
  // templates are pinned the same way, and the counts that stayed accurate
  // are exactly the ones a test held.
  it('has 51 kinds (matches spec/09)', () => {
    expect(unionMembers).toHaveLength(51);
  });
});
