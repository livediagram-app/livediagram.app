import { describe, expect, it } from 'vitest';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { boxesFromLabel, moveBox, resizeBox, withKind } from './photo-boxes';

// Correcting a box on the photograph under review (spec/139 Phase 9). All in
// WORKING-image pixels, the space the detector found the boxes in.
const frame = { width: 1000, height: 500 };
const box = (over: Partial<DetectedSticky> = {}): DetectedSticky => ({
  id: 7,
  kind: 'domain-event',
  size: 'square',
  x: 100,
  y: 100,
  w: 50,
  h: 50,
  row: 0,
  order: 0,
  confidence: 0.9,
  ...over,
});

describe('moveBox', () => {
  it('moves by the drag', () => {
    expect(moveBox(box(), 30, -20, frame)).toMatchObject({ x: 130, y: 80, w: 50, h: 50 });
  });

  it('keeps the whole box on the photo', () => {
    expect(moveBox(box(), -500, 900, frame)).toMatchObject({ x: 0, y: 450 });
  });
});

describe('resizeBox', () => {
  it('drags the corner that was grabbed, and leaves the opposite one where it is', () => {
    expect(resizeBox(box(), 'se', 20, 10, frame)).toMatchObject({ x: 100, y: 100, w: 70, h: 60 });
    expect(resizeBox(box(), 'nw', 20, 10, frame)).toMatchObject({ x: 120, y: 110, w: 30, h: 40 });
    expect(resizeBox(box(), 'ne', 20, 10, frame)).toMatchObject({ x: 100, y: 110, w: 70, h: 40 });
    expect(resizeBox(box(), 'sw', 20, 10, frame)).toMatchObject({ x: 120, y: 100, w: 30, h: 60 });
  });

  it('never turns a box inside out, however far a corner is dragged', () => {
    const squashed = resizeBox(box(), 'se', -400, -400, frame);
    expect(squashed.w).toBeGreaterThanOrEqual(4);
    expect(squashed.h).toBeGreaterThanOrEqual(4);
    expect(squashed).toMatchObject({ x: 100, y: 100 });
  });

  it('never grows a box off the photo', () => {
    expect(resizeBox(box(), 'nw', -500, -500, frame)).toMatchObject({ x: 0, y: 0, w: 150, h: 150 });
  });
});

describe('withKind', () => {
  it('changes the kind, and the silhouette that goes with it', () => {
    expect(withKind(box(), 'policy')).toMatchObject({ kind: 'policy', size: 'wide' });
  });
});

describe('boxesFromLabel', () => {
  const label = {
    photo: 'wall',
    labelledOn: { width: 1000, height: 500 },
    notes: [
      { x: 0.1, y: 0.2, w: 0.05, h: 0.1, kind: 'command', text: 'Place order' },
      { x: 0.5, y: 0.5, w: 0.05, h: 0.1, kind: 'policy' },
    ],
  };

  it('puts the labelled boxes back on the photo, in its working pixels', () => {
    const { boxes } = boxesFromLabel(label, 'wall.jpg', { width: 2000, height: 1000 });
    expect(boxes[0]).toMatchObject({ x: 200, y: 200, w: 100, h: 100, kind: 'command' });
    expect(boxes[1]).toMatchObject({ kind: 'policy', size: 'wide' });
  });

  it('brings the words back with them', () => {
    const { boxes, words } = boxesFromLabel(label, 'wall.jpg', frame);
    expect(words.get(boxes[0]!.id)).toBe('Place order');
    expect(words.has(boxes[1]!.id)).toBe(false);
  });

  it('gives them ids no detection or drawn box will ever use', () => {
    // Detected ids are the reader's crop ids (0, 1, 2…) and drawn boxes count
    // down from -1; a label's boxes must collide with neither.
    const { boxes } = boxesFromLabel(label, 'wall.jpg', frame);
    for (const b of boxes) expect(b.id).toBeLessThanOrEqual(-100_000);
    expect(new Set(boxes.map((b) => b.id)).size).toBe(boxes.length);
  });

  it('refuses a label for a different photo, by name', () => {
    expect(() => boxesFromLabel(label, 'another.jpg', frame)).toThrow(/wall.*another/);
  });

  it('refuses a file that is not a label', () => {
    expect(() => boxesFromLabel({ photo: 'wall' } as never, 'wall.jpg', frame)).toThrow(/label/i);
  });
});
