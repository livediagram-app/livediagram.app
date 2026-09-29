import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES, isValidElement, isValidTab } from './validate';

// The element vocabulary exists twice, like the shape vocabulary next door
// (shape-kind.test.ts): as the `Element` union — nine boxed interfaces in
// element-types.ts plus `ArrowElement` in arrow-types.ts, each with a literal
// `type` discriminant — and as the runtime `ELEMENT_TYPES` set in validate.ts.
//
// This one is worth MORE than the shape guard, because the failure is bigger.
// A shape kind missing from SHAPE_KINDS is coerced to a square: wrong, visible,
// recoverable. An element type missing from ELEMENT_TYPES makes
// `isValidElement` reject it, and `isValidTab` rejects a tab if ANY element
// fails — so `POST/PUT /api/diagrams/:id[/tabs/:tabId]` answers
// `400 invalid tab` and the tab stops persisting entirely. Every save of a tab
// holding one of those elements fails, and the MCP's create_diagram / add_tab /
// update_diagram refuse it too. Add an element type, wire it through the
// editor, forget this one Set, and the feature works right up until the first
// save.
//
// ELEMENT_TYPES is also what the MCP hands the calling model as the list of
// types it may emit (apps/mcp/src/schema.ts), so a missing entry is invisible
// to AI callers as well.
//
// The union is compile-time only, so its members are read out of the source,
// the same way shape-kind.test.ts does it.

function read(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
}

const BOXED_SRC = read('./element-types.ts');
const ARROW_SRC = read('./arrow-types.ts');
const INDEX_SRC = read('./index.ts');

// Each element interface declares its discriminant as `  type: 'shape';`.
const discriminants = (src: string): string[] =>
  [...src.matchAll(/^ {2}type: '([\w-]+)';/gm)].map((m) => m[1]!);

const boxedTypes = discriminants(BOXED_SRC);
const arrowTypes = discriminants(ARROW_SRC);
const declaredTypes = [...boxedTypes, ...arrowTypes];

// The interfaces named in `export type BoxedElement = A | B | …`. An interface
// with a discriminant that never joins the union is unreachable: nothing can
// hold one, so the validator entry for it is dead too.
const boxedUnionMembers = (() => {
  const block = /export type BoxedElement =([\s\S]*?);/.exec(INDEX_SRC)?.[1] ?? '';
  return [...block.matchAll(/\|?\s*(\w+Element)\b/g)].map((m) => m[1]!);
})();

describe('the element vocabulary', () => {
  it('reads its members out of the source (guard against a regex gone blind)', () => {
    // If the interfaces are reformatted so the extraction stops matching, every
    // assertion below would pass vacuously against an empty list.
    expect(boxedTypes.length).toBeGreaterThan(5);
    expect(boxedTypes).toContain('shape');
    expect(arrowTypes).toEqual(['arrow']);
    expect(boxedUnionMembers.length).toBeGreaterThan(5);
    expect(boxedUnionMembers).toContain('ShapeElement');
  });

  it('declares every discriminant exactly once', () => {
    expect(new Set(declaredTypes).size).toBe(declaredTypes.length);
  });

  it('keeps the runtime ELEMENT_TYPES set in step with the Element union', () => {
    // The direction that breaks saving: a type the validator would reject.
    expect(declaredTypes.filter((t) => !ELEMENT_TYPES.has(t))).toEqual([]);
    // And the reverse: a type the validator accepts that no interface
    // describes, which would be validated as a boxed element on the strength of
    // its box alone and told to the AI as something it may emit.
    expect([...ELEMENT_TYPES].filter((t) => !declaredTypes.includes(t))).toEqual([]);
  });

  it('puts every boxed interface into the BoxedElement union', () => {
    // Counted rather than name-matched: the discriminant ('link-card') and the
    // interface name (LinkCardElement) are different spellings of one thing, so
    // a mismatch in either list shows up as a different length.
    expect(boxedUnionMembers).toHaveLength(boxedTypes.length);
  });
});

// The source scan above proves the two LISTS agree. It cannot prove the
// validator actually handles each type — a branch demanding a field the editor
// never sets would pass every check above and still 400 every save. So each
// type is exercised through the real validator, with the minimum its branch
// asks for.
const MINIMAL_BOX = { x: 0, y: 0, width: 10, height: 10 };

const FIXTURES: Record<string, Record<string, unknown>> = {
  shape: { ...MINIMAL_BOX, shape: 'square' },
  text: { ...MINIMAL_BOX },
  table: { ...MINIMAL_BOX, cells: [['a', 'b']] },
  sticky: { ...MINIMAL_BOX },
  image: { ...MINIMAL_BOX, imageId: 'img_1' },
  freehand: { ...MINIMAL_BOX, closed: false, points: [{ nx: 0, ny: 0 }] },
  annotation: { ...MINIMAL_BOX },
  'link-card': { ...MINIMAL_BOX },
  video: { ...MINIMAL_BOX },
  arrow: { from: { kind: 'free', x: 0, y: 0 }, to: { kind: 'free', x: 1, y: 1 } },
};

describe('the validator accepts every type it lists', () => {
  it('has a fixture for each type, so none is silently skipped', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual([...ELEMENT_TYPES].sort());
  });

  it('accepts a minimal element of every type', () => {
    const rejected = Object.entries(FIXTURES)
      .filter(([type, fields]) => !isValidElement({ id: `e-${type}`, type, ...fields }))
      .map(([type]) => type);
    expect(rejected).toEqual([]);
  });

  it('accepts a tab holding one of each, which is what the api gates on', () => {
    const elements = Object.entries(FIXTURES).map(([type, fields]) => ({
      id: `e-${type}`,
      type,
      ...fields,
    }));
    expect(isValidTab({ id: 't1', name: 'Tab', elements })).toBe(true);
  });

  it('still rejects an unknown type, and rejects the whole tab with it', () => {
    // The behaviour that makes the drift above so expensive, pinned so it is
    // understood as deliberate: one bad element loses the tab, not the element.
    const bogus = { id: 'e-x', type: 'hologram', ...MINIMAL_BOX };
    expect(isValidElement(bogus)).toBe(false);
    expect(isValidTab({ id: 't1', name: 'Tab', elements: [bogus] })).toBe(false);
  });
});
