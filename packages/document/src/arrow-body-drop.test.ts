import { describe, expect, it } from 'vitest';
import { bodyDropAnchor } from './arrow-body-drop';
import type { Element } from './index';

// docs/specs/008-canvas/canvas-and-palette.md "Dropped on a shape".

const box = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 60, ...extra });

describe('bodyDropAnchor', () => {
  it('pins to the side facing the other end', () => {
    const els = [box('a', 0, 0), box('b', 300, 0), box('c', 0, 300)];
    // From the left: the target's west side; from above: the target's north side.
    expect(bodyDropAnchor({ x: 350, y: 30 }, els, { x: 100, y: 30 }, 'a')).toEqual({
      elementId: 'b',
      anchor: 'w',
    });
    expect(bodyDropAnchor({ x: 50, y: 330 }, els, { x: 50, y: 60 }, 'a')).toEqual({
      elementId: 'c',
      anchor: 'n',
    });
  });

  it('is null off every shape, and outside a diamond though inside its box', () => {
    const els = [box('a', 0, 0), box('d', 300, 0, { shape: 'diamond' })];
    expect(bodyDropAnchor({ x: 200, y: 30 }, els, { x: 0, y: 0 }, null)).toBeNull();
    // The diamond's top-left corner of its box is outside its outline.
    expect(bodyDropAnchor({ x: 304, y: 4 }, els, { x: 0, y: 0 }, null)).toBeNull();
  });

  it('takes the topmost shape under the point', () => {
    const els = [box('under', 300, 0), box('over', 320, 10)];
    expect(bodyDropAnchor({ x: 350, y: 30 }, els, { x: 0, y: 30 }, null)?.elementId).toBe('over');
  });

  it('passes over containers, chips, pictures, drawings and the shape the other end is on', () => {
    const frame = box('frame', 0, 0, { shape: 'frame', width: 1000, height: 1000 });
    const inner = box('inner', 400, 400);
    const point = { x: 450, y: 430 };
    // A frame alone is drawn across, not onto.
    expect(bodyDropAnchor(point, [frame], { x: 0, y: 0 }, null)).toBeNull();
    // A member inside it is still a target.
    expect(bodyDropAnchor(point, [frame, inner], { x: 0, y: 430 }, null)?.elementId).toBe('inner');
    // The end's own source: no loop back while the arrow leaves it.
    expect(bodyDropAnchor(point, [frame, inner], { x: 0, y: 430 }, 'inner')).toBeNull();
    const at = (el: Element) => bodyDropAnchor({ x: 50, y: 30 }, [el], { x: -200, y: 30 }, null);
    expect(at(box('badge', 0, 0, { shape: 'badge' }))).toBeNull();
    expect(
      at({ id: 'img', type: 'image', x: 0, y: 0, width: 100, height: 60 } as Element),
    ).toBeNull();
    expect(at(box('sticky', 0, 0, { type: 'sticky' }))).toEqual({
      elementId: 'sticky',
      anchor: 'w',
    });
  });

  it('reads a rotated shape by its outline', () => {
    // A long bar turned upright: the point above its unrotated box is inside it.
    const bar = box('bar', 0, 100, { width: 200, height: 20, rotation: 90 });
    expect(bodyDropAnchor({ x: 100, y: 40 }, [bar], { x: 100, y: -300 }, null)?.elementId).toBe(
      'bar',
    );
  });
});
