import { describe, expect, it } from 'vitest';
import {
  anchorPosition,
  bringManyToFront,
  bringToFront,
  elementBounds,
  endpointPosition,
  isBoxed,
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

  it('anchors a Technology icon on its fixed-size mark, not the element box (docs/specs/010-palette/technology-icons.md)', () => {
    // 200x100 box, no label: the md (48px) mark centres at (76..124, 26..74),
    // so connectors touch the visible chip instead of floating on the box edge.
    const tech = shape('t', { shape: 'icon', iconId: 'aws-ec2', width: 200, height: 100 });
    expect(anchorPosition(tech, 'e')).toEqual({ x: 124, y: 50 });
    expect(anchorPosition(tech, 's')).toEqual({ x: 100, y: 74 });
    // A line-art icon keeps box anchors — its glyph scales with the box.
    const line = shape('l', { shape: 'icon', iconId: 'server', width: 200, height: 100 });
    expect(anchorPosition(line, 'e')).toEqual({ x: 200, y: 50 });
  });

  it("pushes a captioned tech icon's caption-side anchor to the element edge", () => {
    // 200x100 box with a bottom caption: band y 6..64, so the 48px mark sits
    // at (76, 11)..(124, 59). Side anchors stay on the chip; the SOUTH anchor
    // (the caption's side) pushes to the element's bottom line so a downward
    // connector starts under the text instead of crossing it.
    const tech = shape('t', {
      shape: 'icon',
      iconId: 'aws-ec2',
      width: 200,
      height: 100,
      label: 'EC2',
    });
    expect(anchorPosition(tech, 'e')).toEqual({ x: 124, y: 35 });
    const n = anchorPosition(tech, 'n');
    expect(n.x).toBe(100);
    expect(n.y).toBeCloseTo(11);
    expect(anchorPosition(tech, 's')).toEqual({ x: 100, y: 100 });
    // Top-aligned caption mirrors: the NORTH anchor pushes to the top line.
    const topCap = shape('t2', {
      shape: 'icon',
      iconId: 'aws-ec2',
      width: 200,
      height: 100,
      label: 'EC2',
      textAlignY: 'top',
    });
    expect(anchorPosition(topCap, 'n')).toEqual({ x: 100, y: 0 });
    expect(anchorPosition(topCap, 's').y).toBeCloseTo(89); // mark bottom (band y 36..94, 48px mark centred)
  });

  it('projects diamond anchors onto the diamond outline (corners land on the slanted edge)', () => {
    const d = shape('d', { shape: 'diamond', x: 0, y: 0, width: 100, height: 100 });
    // Cardinal anchors are the diamond's tips already — unchanged.
    expect(anchorPosition(d, 'n')).toEqual({ x: 50, y: 0 });
    expect(anchorPosition(d, 'e')).toEqual({ x: 100, y: 50 });
    // The NE bbox corner (100,0) is empty space outside the diamond; it
    // projects to the midpoint of the top-right edge instead of floating.
    const ne = anchorPosition(d, 'ne');
    expect(ne.x).toBeCloseTo(75, 6);
    expect(ne.y).toBeCloseTo(25, 6);
  });

  it('projects circle anchors onto the ellipse (corners pull in to the curve)', () => {
    const c = shape('c', { shape: 'circle', x: 0, y: 0, width: 100, height: 100 });
    // Cardinals sit on the circle already.
    expect(anchorPosition(c, 'e')).toEqual({ x: 100, y: 50 });
    // The NE corner pulls in to the 45deg point on the circle (r=50).
    const ne = anchorPosition(c, 'ne');
    expect(ne.x).toBeCloseTo(50 + 50 / Math.SQRT2, 6);
    expect(ne.y).toBeCloseTo(50 - 50 / Math.SQRT2, 6);
  });

  it('leaves rectangular shapes (square / text / table) on the bounding box', () => {
    const sq = shape('s', { shape: 'square', x: 0, y: 0, width: 100, height: 100 });
    expect(anchorPosition(sq, 'ne')).toEqual({ x: 100, y: 0 });
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

  it('resolves an on-arrow endpoint to a point along the target arrow (docs/specs/008-canvas/arrow-to-arrow.md)', () => {
    // A straight arrow from (0,0) to (100,0); t=0.5 is its midpoint.
    const line: ArrowElement = {
      id: 'line',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 100, y: 0 },
    };
    const p = endpointPosition({ kind: 'on-arrow', arrowId: 'line', t: 0.5 }, [line]);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(0, 5);
    // t=0 / t=1 land on the target's own endpoints.
    expect(endpointPosition({ kind: 'on-arrow', arrowId: 'line', t: 0 }, [line])).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('falls back to the origin when the on-arrow target is missing', () => {
    expect(endpointPosition({ kind: 'on-arrow', arrowId: 'gone', t: 0.5 }, [target])).toEqual({
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
