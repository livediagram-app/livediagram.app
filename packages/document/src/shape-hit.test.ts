import { describe, expect, it } from 'vitest';
import { rotatePoint, type Point } from './geometry-primitives';
import type { Element, ShapeElement } from './index';
import {
  hasVisibleFill,
  hitOutlinePathData,
  pickedByOutline,
  shapeHitOutline,
  shapeTouchesBrush,
} from './shape-hit';
import type { ShapeKind } from './shape-kind';

const shape = (kind: ShapeKind, over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: kind,
  type: 'shape',
  shape: kind,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fillColor: 'transparent',
  ...over,
});

// A brush of radius `r` pressed at one point.
const hits = (el: ShapeElement, p: Point, r = 0.5) => shapeTouchesBrush(el, p, p, r);

describe('pickedByOutline', () => {
  it.each<ShapeKind>([
    'square',
    'circle',
    'stadium',
    'browser',
    'page',
    'diamond',
    'cylinder',
    'triangle',
    'star',
    'cloud',
    'speech-bubble',
    'frame',
    'laptop',
    'actor',
  ])('picks a %s by its drawn outline', (kind) => {
    expect(pickedByOutline(shape(kind))).toBe(true);
  });

  it.each<ShapeKind>(['icon', 'pie-chart', 'estimate', 'callout', 'chair', 'mode-button'])(
    'keeps the box of a %s, which paints its own face',
    (kind) => {
      expect(pickedByOutline(shape(kind))).toBe(false);
    },
  );

  it('keeps the box of a note and a text box', () => {
    const note = { id: 'n', type: 'sticky', x: 0, y: 0, width: 100, height: 100 } as Element;
    const text = { id: 't', type: 'text', x: 0, y: 0, width: 100, height: 40 } as Element;
    expect(pickedByOutline(note)).toBe(false);
    expect(pickedByOutline(text)).toBe(false);
  });
});

describe('hasVisibleFill', () => {
  it('reads a transparent fill as none and a theme default as visible', () => {
    expect(hasVisibleFill(shape('square'))).toBe(false);
    expect(hasVisibleFill(shape('square', { fillColor: 'none' }))).toBe(false);
    expect(hasVisibleFill(shape('square', { fillColor: '#fde68a' }))).toBe(true);
    expect(hasVisibleFill(shape('square', { fillColor: undefined }))).toBe(true);
  });

  it('reads a frame with no fill of its own as see-through', () => {
    expect(hasVisibleFill(shape('frame', { fillColor: undefined }))).toBe(false);
  });
});

describe('shapeTouchesBrush', () => {
  describe('square', () => {
    const sq = (over: Partial<ShapeElement> = {}) => shape('square', { width: 200, ...over });

    it('touches on the border, drawn half its width inside the box', () => {
      expect(hits(sq(), { x: 100, y: 1 }, 0)).toBe(true);
      // The medium border reaches 1px either side of its line.
      expect(hits(sq(), { x: 100, y: -4 }, 4)).toBe(true);
      expect(hits(sq(), { x: 100, y: -6 }, 4)).toBe(false);
    });

    it('does not touch an empty inside', () => {
      expect(hits(sq(), { x: 100, y: 50 }, 5)).toBe(false);
    });

    it('touches anywhere on a visible fill', () => {
      expect(hits(sq({ fillColor: '#fde68a' }), { x: 100, y: 50 })).toBe(true);
      expect(hits(sq({ fillColor: undefined }), { x: 100, y: 50 })).toBe(true);
    });

    it('follows the corner radius, not the box corner', () => {
      expect(hits(sq(), { x: 0, y: 0 }, 2)).toBe(false);
      expect(hits(sq({ borderRadius: 'none' }), { x: 0, y: 0 }, 2)).toBe(true);
      // A full radius is a stadium: the box corner is well clear of it.
      expect(hits(sq({ borderRadius: 'full' }), { x: 5, y: 5 }, 3)).toBe(false);
    });

    it('follows the rotation about the centre', () => {
      const turned = sq({ rotation: 90 });
      const centre = { x: 100, y: 50 };
      expect(hits(turned, rotatePoint({ x: 100, y: 1 }, centre, 90), 0.5)).toBe(true);
      // The unrotated right edge is now empty board.
      expect(hits(turned, { x: 199, y: 50 }, 2)).toBe(false);
    });

    it('touches when the sweep crosses the outline, not when it stays inside', () => {
      expect(shapeTouchesBrush(sq(), { x: -20, y: 50 }, { x: 220, y: 50 }, 2)).toBe(true);
      expect(shapeTouchesBrush(sq(), { x: 40, y: 50 }, { x: 160, y: 50 }, 2)).toBe(false);
      expect(
        shapeTouchesBrush(sq({ fillColor: '#fff' }), { x: 40, y: 50 }, { x: 160, y: 50 }, 2),
      ).toBe(true);
    });

    it('reads the element position', () => {
      const moved = sq({ x: 500, y: 300 });
      expect(hits(moved, { x: 600, y: 301 }, 0.5)).toBe(true);
      expect(hits(moved, { x: 100, y: 1 }, 2)).toBe(false);
    });
  });

  it('picks an ellipse by its curve', () => {
    const c = shape('circle');
    expect(hits(c, { x: 50, y: 1 })).toBe(true);
    expect(hits(c, { x: 3, y: 3 }, 3)).toBe(false);
    expect(hits(c, { x: 50, y: 50 }, 10)).toBe(false);
  });

  it('picks a diamond by its four edges', () => {
    const d = shape('diamond');
    expect(hits(d, { x: 25, y: 25 })).toBe(true);
    expect(hits(d, { x: 50, y: 50 }, 10)).toBe(false);
    expect(hits(d, { x: 2, y: 2 }, 5)).toBe(false);
  });

  it('picks a cylinder by its body and rim', () => {
    const c = shape('cylinder');
    // The top rim's lower curve crosses the middle at 27% of the height.
    expect(hits(c, { x: 50, y: 27 })).toBe(true);
    expect(hits(c, { x: 0, y: 50 })).toBe(true);
    expect(hits(c, { x: 50, y: 55 }, 10)).toBe(false);
  });

  it('picks a triangle and a star by their edges', () => {
    expect(hits(shape('triangle'), { x: 50, y: 2 })).toBe(true);
    expect(hits(shape('triangle'), { x: 50, y: 65 }, 10)).toBe(false);
    expect(hits(shape('star'), { x: 50, y: 2 })).toBe(true);
    expect(hits(shape('star'), { x: 50, y: 50 }, 5)).toBe(false);
  });

  it('picks a speech bubble by its tail, drawn below the box', () => {
    expect(hits(shape('speech-bubble'), { x: 26, y: 120 })).toBe(true);
    expect(hits(shape('speech-bubble'), { x: 50, y: 50 }, 10)).toBe(false);
  });

  it('fits the actor into its box as drawn, and fills its head', () => {
    const actor = shape('actor', { width: 90, height: 130 });
    expect(hits(actor, { x: 45, y: 6 })).toBe(true);
    expect(hits(actor, { x: 45, y: 22 })).toBe(false);
    expect(hits({ ...actor, fillColor: '#fff' }, { x: 45, y: 22 })).toBe(true);
  });

  it('picks a browser by its frame and its chrome divider', () => {
    const b = shape('browser', { width: 400, height: 300 });
    // The strip's 1px bottom rule, inside the medium border.
    expect(hits(b, { x: 200, y: 49.5 })).toBe(true);
    expect(hits(b, { x: 200, y: 150 }, 10)).toBe(false);
  });

  it('touches the whole box of a kind that paints its own face', () => {
    expect(hits(shape('pie-chart'), { x: 50, y: 50 })).toBe(true);
    expect(hits(shape('pie-chart', { rotation: 45 }), { x: 2, y: 2 })).toBe(false);
  });
});

describe('shapeHitOutline', () => {
  it('carries the border half width and one closed ring for a square', () => {
    const outline = shapeHitOutline(shape('square'));
    expect(outline.halfWidth).toBe(1);
    expect(outline.lines).toHaveLength(1);
    expect(outline.lines[0]!.closed).toBe(true);
    expect(outline.fills).toHaveLength(0);
  });

  it('adds the fill regions when the fill is visible', () => {
    expect(shapeHitOutline(shape('cylinder', { fillColor: '#fff' })).fills).toHaveLength(2);
  });

  it('draws every stroked part, the laptop keys included', () => {
    expect(shapeHitOutline(shape('laptop', { width: 160 })).lines.length).toBeGreaterThan(40);
  });
});

describe('hitOutlinePathData', () => {
  it('writes each line as a subpath, closing the closed ones', () => {
    expect(
      hitOutlinePathData([
        {
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
        },
        {
          closed: false,
          points: [
            { x: 20, y: 0 },
            { x: 30, y: 5.123 },
          ],
        },
      ]),
    ).toBe('M 0 0 L 10 0 L 10 10 Z M 20 0 L 30 5.12');
  });
});
