import { describe, expect, it } from 'vitest';
import { createShape, elementSupportsText, isValidElement, SHAPE_DEFAULT_SIZE } from './index';
import { SHAPE_KINDS } from './validate';
import type { ShapeKind } from './shape-kind';

// createShape is a per-kind seeding ladder: fifteen-odd `if (kind === …)`
// branches that add default data (a mode button's skin, a chart's slices, a
// checklist's rows), falling through to a plain box for everything else.
// Twenty of the fifty-one kinds appear in some test somewhere; the rest have
// never been through the factory at all.
//
// Rather than seed-check each kind — which would restate the ladder — these
// walk the whole vocabulary and hold the properties every created shape owes
// its consumers, whichever branch made it.
//
// The load-bearing one is the round trip with isValidElement. The factory
// makes elements; the validator guards untrusted ones arriving from the MCP
// server and the AI panel. If a branch ever seeds a field the validator
// rejects, the editor would create an element that its own API refuses to
// take back — and nothing else in the suite compares the two.

const ALL = [...SHAPE_KINDS] as ShapeKind[];

describe('createShape, across the whole vocabulary', () => {
  it('walks the real kind list (guard against an empty enumeration)', () => {
    expect(ALL.length).toBeGreaterThan(40);
  });

  it('produces something the validator accepts, for every kind', () => {
    expect(ALL.filter((k) => !isValidElement(createShape(k, 0, 0)))).toEqual([]);
  });

  it('keeps the kind it was asked for', () => {
    // A ladder branch that spreads `base` but forgets `shape` would silently
    // hand back whatever the previous branch set.
    const wrong = ALL.filter((k) => {
      const el = createShape(k, 0, 0);
      return el.type !== 'shape' || el.shape !== k;
    });
    expect(wrong).toEqual([]);
  });

  it('lands where it was told to', () => {
    const el = createShape('square', 137, -42);
    expect([el.x, el.y]).toEqual([137, -42]);
  });

  it('gives every kind a positive size, from the declared default', () => {
    const bad = ALL.filter((k) => {
      const el = createShape(k, 0, 0);
      const want = SHAPE_DEFAULT_SIZE[k];
      return el.width !== want.width || el.height !== want.height || el.width <= 0;
    });
    expect(bad).toEqual([]);
  });

  it('gives every shape its own id', () => {
    const ids = ALL.map((k) => createShape(k, 0, 0).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never seeds a label onto a shape that cannot show one', () => {
    // The self-drawing kinds have no editable label (elementSupportsText is
    // false for them), so a seeded `label` would be invisible and uneditable —
    // present in the model, gone from the UI.
    const bad = ALL.filter((k) => {
      const el = createShape(k, 0, 0);
      return !elementSupportsText(el) && typeof el.label === 'string' && el.label.length > 0;
    });
    expect(bad).toEqual([]);
  });
});
