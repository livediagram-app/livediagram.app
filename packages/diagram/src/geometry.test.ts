import { describe, expect, it } from 'vitest';
import {
  anchorPosition,
  bestAnchorTowards,
  bringManyToFront,
  bringToFront,
  elementBounds,
  endpointPosition,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  sendManyToBack,
  sendToBack,
  snapToAnchor,
  supportsBorder,
  supportsColours,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from './index';

const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

describe('anchorPosition', () => {
  const box = shape('a', { x: 10, y: 20, width: 100, height: 80 });

  it('places each of the eight anchors on the box edges', () => {
    expect(anchorPosition(box, 'nw')).toEqual({ x: 10, y: 20 });
    expect(anchorPosition(box, 'n')).toEqual({ x: 60, y: 20 });
    expect(anchorPosition(box, 'ne')).toEqual({ x: 110, y: 20 });
    expect(anchorPosition(box, 'e')).toEqual({ x: 110, y: 60 });
    expect(anchorPosition(box, 'se')).toEqual({ x: 110, y: 100 });
    expect(anchorPosition(box, 's')).toEqual({ x: 60, y: 100 });
    expect(anchorPosition(box, 'sw')).toEqual({ x: 10, y: 100 });
    expect(anchorPosition(box, 'w')).toEqual({ x: 10, y: 60 });
  });

  it('treats rotation 0 / absent as unrotated', () => {
    expect(anchorPosition(shape('a', { rotation: 0 }), 'e')).toEqual({ x: 100, y: 40 });
  });

  it('rotates the anchor about the element centre (90deg clockwise)', () => {
    // Square at (0,0) 100x100, centre (50,50), spun 90deg clockwise:
    // each edge anchor moves a quarter-turn round the centre.
    const sq = shape('s', { width: 100, height: 100, rotation: 90 });
    const close = (p: { x: number; y: number }, x: number, y: number) => {
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.y).toBeCloseTo(y, 6);
    };
    close(anchorPosition(sq, 'e'), 50, 100); // east edge swings to the south
    close(anchorPosition(sq, 'n'), 100, 50); // north edge swings to the east
    close(anchorPosition(sq, 'nw'), 100, 0); // nw corner swings to the ne corner
  });
});

describe('endpointPosition', () => {
  const target = shape('t', { x: 0, y: 0, width: 100, height: 100 });

  it('returns the literal coordinates of a free endpoint', () => {
    expect(endpointPosition({ kind: 'free', x: 7, y: 9 }, [])).toEqual({ x: 7, y: 9 });
  });

  it('resolves a pinned endpoint through its target anchor', () => {
    expect(endpointPosition({ kind: 'pinned', elementId: 't', anchor: 'se' }, [target])).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('falls back to the origin when the pinned target is missing', () => {
    expect(endpointPosition({ kind: 'pinned', elementId: 'gone', anchor: 'n' }, [target])).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('elementBounds', () => {
  it('returns a boxed element rectangle directly', () => {
    const box = shape('a', { x: 5, y: 6, width: 30, height: 40 });
    expect(elementBounds(box, [box])).toEqual({ x: 5, y: 6, width: 30, height: 40 });
  });

  it('derives an arrow AABB from its endpoints regardless of direction', () => {
    const arrow: ArrowElement = {
      id: 'e',
      type: 'arrow',
      from: { kind: 'free', x: 100, y: 80 },
      to: { kind: 'free', x: 20, y: 10 },
    };
    expect(elementBounds(arrow, [])).toEqual({ x: 20, y: 10, width: 80, height: 70 });
  });
});

describe('snapToAnchor', () => {
  const box = shape('a', { x: 0, y: 0, width: 100, height: 100 });

  it('returns the nearest anchor within the threshold', () => {
    // Just outside the NE corner (100, 0).
    expect(snapToAnchor({ x: 104, y: 3 }, [box], 10)).toEqual({
      elementId: 'a',
      anchor: 'ne',
    });
  });

  it('returns null when no anchor is within the threshold', () => {
    expect(snapToAnchor({ x: 500, y: 500 }, [box], 10)).toBeNull();
  });

  it('ignores arrows (only boxed elements have anchors)', () => {
    const arrow: ArrowElement = {
      id: 'e',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 10 },
    };
    expect(snapToAnchor({ x: 0, y: 0 }, [arrow], 10)).toBeNull();
  });
});

describe('bestAnchorTowards', () => {
  // A 100x80 box centred at (60, 60). Used for every directional case
  // so the test names read like a compass.
  const box = shape('a', { x: 10, y: 20, width: 100, height: 80 });

  it('picks the east cardinal when the target is purely to the right', () => {
    expect(bestAnchorTowards(box, { x: 300, y: 60 })).toBe('e');
  });
  it('picks the west cardinal when the target is purely to the left', () => {
    expect(bestAnchorTowards(box, { x: -300, y: 60 })).toBe('w');
  });
  it('picks the south cardinal when the target is purely below', () => {
    expect(bestAnchorTowards(box, { x: 60, y: 400 })).toBe('s');
  });
  it('picks the north cardinal when the target is purely above', () => {
    expect(bestAnchorTowards(box, { x: 60, y: -400 })).toBe('n');
  });
  it('still picks east when horizontal dominates by 2x (cardinal bias)', () => {
    // dx=200, dy=80: 2x ratio exactly, so cardinal wins over the corner.
    expect(bestAnchorTowards(box, { x: 260, y: 140 })).toBe('e');
  });
  it('picks the south-east corner when the target is diagonal-ish', () => {
    // dx=100, dy=100: same magnitude on both axes, neither dominates,
    // so we fall through to the corner.
    expect(bestAnchorTowards(box, { x: 160, y: 160 })).toBe('se');
  });
  it('picks each quadrant corner for the four diagonal directions', () => {
    expect(bestAnchorTowards(box, { x: 160, y: -40 })).toBe('ne');
    expect(bestAnchorTowards(box, { x: -40, y: 160 })).toBe('sw');
    expect(bestAnchorTowards(box, { x: -40, y: -40 })).toBe('nw');
  });
  it('accounts for rotation: a 90deg-CW box facing a target to the east picks its local north face', () => {
    // Spun 90deg clockwise, the local north edge now points east in
    // world space, so a target to the right resolves to the 'n' anchor
    // (which anchorPosition then rotates back out to the east side).
    const spun = shape('a', { x: 10, y: 20, width: 100, height: 80, rotation: 90 });
    expect(bestAnchorTowards(spun, { x: 300, y: 60 })).toBe('n');
  });
});

describe('rebindArrowAnchorsAfterMove', () => {
  // Two boxes + a pinned-to-pinned arrow between them. The default
  // anchors point east-from-a, west-into-b (a classic LTR connector).
  // Tests drag various boxes around and assert the helper picks the
  // face the arrow should switch to.
  const a = (): ShapeElement =>
    ({ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }) as const;
  const b = (overrides: Partial<ShapeElement> = {}): ShapeElement =>
    ({
      id: 'b',
      type: 'shape',
      shape: 'square',
      x: 200,
      y: 0,
      width: 100,
      height: 80,
      ...overrides,
    }) as const;
  const arrow = (): ArrowElement =>
    ({
      id: 'arr',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    }) as const;

  it('returns the same arrow when no endpoint is in the moving set', () => {
    const els: Element[] = [a(), b(), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['unrelated']));
    expect(out[2]).toEqual(els[2]);
  });

  it('flips both anchors when b moves above a (now a vertical arrow)', () => {
    // b at (90, -300) puts it directly above a, so a should point
    // north and b should point south.
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('n');
    expect(next.to.kind === 'pinned' && next.to.anchor).toBe('s');
  });

  it('leaves arrows with a free endpoint untouched (only the pinned end would change, which jitters under drag)', () => {
    const mixed: ArrowElement = {
      id: 'arr2',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'free', x: 400, y: 400 },
    };
    const els: Element[] = [a(), mixed];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['a']));
    expect(out[1]).toEqual(mixed);
  });

  it('accepts a Map as movingIds so callers can pass startBounds directly', () => {
    // useEditorDrag's drag.startBounds is a Map<id, ShapeBounds>;
    // the helper supports Map natively so the call site doesn't
    // have to materialise a fresh Set.
    const movingIds = new Map([['b', { x: 0, y: 0, width: 1, height: 1 }]]);
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, movingIds);
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.anchor).toBe('n');
  });

  it('preserves elementId + kind when re-anchoring (only `anchor` changes)', () => {
    const els: Element[] = [a(), b({ x: 90, y: -300 }), arrow()];
    const out = rebindArrowAnchorsAfterMove(els, new Set(['b']));
    const next = out[2] as ArrowElement;
    expect(next.from.kind === 'pinned' && next.from.elementId).toBe('a');
    expect(next.to.kind === 'pinned' && next.to.elementId).toBe('b');
  });
});

describe('layer order', () => {
  const ids = (els: Element[]) => els.map((e) => e.id);

  it('bringToFront moves the element to the end (top)', () => {
    const list = [shape('a'), shape('b'), shape('c')];
    expect(ids(bringToFront(list, 'a'))).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack moves the element to the start (bottom)', () => {
    const list = [shape('a'), shape('b'), shape('c')];
    expect(ids(sendToBack(list, 'c'))).toEqual(['c', 'a', 'b']);
  });

  it('bringToFront / sendToBack are no-ops for a missing id', () => {
    const list = [shape('a'), shape('b')];
    expect(bringToFront(list, 'x')).toBe(list);
    expect(sendToBack(list, 'x')).toBe(list);
  });

  it('bringManyToFront keeps members after non-members, preserving order', () => {
    const list = [shape('a'), shape('b'), shape('c'), shape('d')];
    expect(ids(bringManyToFront(list, new Set(['a', 'c'])))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sendManyToBack keeps members before non-members, preserving order', () => {
    const list = [shape('a'), shape('b'), shape('c'), shape('d')];
    expect(ids(sendManyToBack(list, new Set(['b', 'd'])))).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('type predicates', () => {
  const arrow: ArrowElement = {
    id: 'e',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 1, y: 1 },
  };

  // The three element-classification predicates feed dozens of
  // sites (resize handles, paint setters, paletteSelection field
  // gates, marquee inclusion, elementBounds). A regression that
  // misses a new BoxedElement variant tends to surface in
  // confusing ways: a fresh element renders, but its setters
  // no-op, or its bounds compute as zero, or marquee skips it.
  // Cover the full kind matrix here so the next variant has to
  // land in every predicate (or fail loudly) on the way in.

  it('isBoxed is true for every boxed-element kind, false for arrow', () => {
    expect(isBoxed(shape('a'))).toBe(true);
    expect(isBoxed({ ...shape('b'), type: 'text' } as Element)).toBe(true);
    expect(isBoxed({ ...shape('c'), type: 'sticky' } as Element)).toBe(true);
    expect(isBoxed({ ...shape('d'), type: 'image', imageId: null } as Element)).toBe(true);
    // freehand: structurally a boxed element + a normalised polyline.
    // The runtime guard must match the type-union membership; a recent
    // bug left it false here and crashed elementBounds on commit.
    expect(isBoxed({ ...shape('e'), type: 'freehand', points: [], closed: false } as Element)).toBe(
      true,
    );
    expect(isBoxed(arrow)).toBe(false);
  });

  it('supportsColours covers shape, sticky, arrow, freehand; not text or image', () => {
    expect(supportsColours(shape('a'))).toBe(true);
    expect(supportsColours({ ...shape('b'), type: 'sticky' } as Element)).toBe(true);
    expect(supportsColours(arrow)).toBe(true);
    expect(
      supportsColours({
        ...shape('c'),
        type: 'freehand',
        points: [],
        closed: false,
      } as Element),
    ).toBe(true);
    // Text + image elements don't show the Colours accordion's
    // fill / stroke swatches; the negative cases stop a future
    // refactor that "simplifies" the predicate to `isBoxed || arrow`
    // and silently changes the surfaced fields.
    expect(supportsColours({ ...shape('d'), type: 'text' } as Element)).toBe(false);
    expect(supportsColours({ ...shape('e'), type: 'image', imageId: null } as Element)).toBe(false);
  });

  it('supportsBorder is true for shape and freehand only', () => {
    // Border-stroke + border-pattern apply to shapes and the pen
    // tool's freehand element (both render through the same
    // strokeWidth / strokeStyle fields). Everything else (text,
    // sticky, image, arrow) lights up its own controls elsewhere
    // and must NOT receive a BorderStroke / BorderStyle write.
    expect(supportsBorder(shape('a'))).toBe(true);
    expect(
      supportsBorder({
        ...shape('b'),
        type: 'freehand',
        points: [],
        closed: false,
      } as Element),
    ).toBe(true);
    expect(supportsBorder({ ...shape('c'), type: 'sticky' } as Element)).toBe(false);
    expect(supportsBorder({ ...shape('d'), type: 'text' } as Element)).toBe(false);
    expect(supportsBorder({ ...shape('e'), type: 'image', imageId: null } as Element)).toBe(false);
    expect(supportsBorder(arrow)).toBe(false);
  });
});
