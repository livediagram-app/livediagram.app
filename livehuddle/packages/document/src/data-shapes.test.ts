import { describe, expect, it } from 'vitest';
import type { ShapeKind } from './shape-kind';
import { SHAPE_KINDS } from './validate';
import { isSelfDrawingShape } from './data-shapes';

// The self-drawing shape family decides real behaviour: elementSupportsText uses isSelfDrawingShape to decide whether
// an element has an editable label at all, and the context menu hides markers, alignment and morphing for members.
// The data widgets left with Work Tracker #459 (docs/specs/002-project-scope/not-in-livehuddle.md "The element
// engine"), and the Timeline with part 3; what stays is the sticker and the Space pieces.

const ALL = [...SHAPE_KINDS] as ShapeKind[];

describe('the self-drawing shape family', () => {
  it('reads the real vocabulary (guard against an empty enumeration)', () => {
    expect(ALL.length).toBeGreaterThan(40);
  });

  it('claims the sticker, the fence and the scenery', () => {
    for (const kind of ['sticker', 'fence', 'plant', 'corridor'] as ShapeKind[])
      expect(isSelfDrawingShape(kind), kind).toBe(true);
  });

  it('leaves the ordinary shapes alone', () => {
    // A regression here means a plain box lost its label, which is the user-visible cost of a guard that over-claims.
    expect(isSelfDrawingShape('square')).toBe(false);
    expect(isSelfDrawingShape('circle')).toBe(false);
    expect(isSelfDrawingShape('icon')).toBe(false);
  });
});
