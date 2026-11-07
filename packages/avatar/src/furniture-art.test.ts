import { describe, expect, it } from 'vitest';
import {
  allSides,
  CHAIR_ART,
  ellipse,
  furnitureFrame,
  longTableArt,
  MACHINE_ANSWER_AT,
  MEETING_TABLE_ART,
  path,
  rect,
  SHARED_OFFICE_ART,
  SHARED_SEATING_ART,
  turnWithArt,
  type FurnitureDrawing,
} from './furniture-art';
import { SEAT_GRIDS } from './seats';

// The shared drawings (livehuddle's and livediagram's docs/specs/009-elements/furniture-facing.md "The camera").
describe('part builders', () => {
  it('builds a part with its own fill, or none', () => {
    expect(rect('panel', 1, 2, 3, 4, 5)).toEqual({
      tag: 'rect',
      role: 'panel',
      x: 1,
      y: 2,
      w: 3,
      h: 4,
      rx: 5,
    });
    expect(rect('panel', 1, 2, 3, 4, 5, '#fff')).toMatchObject({ fill: '#fff' });
    expect(ellipse('shadow', 1, 2, 3, 4)).not.toHaveProperty('fill');
    expect(ellipse('shadow', 1, 2, 3, 4, '#000')).toMatchObject({ tag: 'ellipse', fill: '#000' });
    expect(path('rail', 'M0 0')).toEqual({ tag: 'path', role: 'rail', d: 'M0 0' });
    expect(path('mark', 'M0 0', '#f00')).toMatchObject({ fill: '#f00' });
  });

  it('shows one drawing from every side', () => {
    const view: FurnitureDrawing = {
      width: 1,
      height: 1,
      seats: [],
      parts: [],
      ring: { cx: 0, cy: 0, rx: 1, ry: 1 },
    };
    expect(allSides(view)).toEqual({ front: view, back: view, side: view });
  });
});

describe('furnitureFrame', () => {
  it('draws the drawing a facing shows, the side mirrored for facing right', () => {
    expect(furnitureFrame(CHAIR_ART, 'n')).toMatchObject({ transform: '', view: CHAIR_ART.front });
    expect(furnitureFrame(CHAIR_ART, 's').view).toBe(CHAIR_ART.back);
    expect(furnitureFrame(CHAIR_ART, 'e')).toMatchObject({ transform: '', view: CHAIR_ART.side });
    const right = furnitureFrame(CHAIR_ART, 'w');
    expect(right.view).toBe(CHAIR_ART.side);
    expect(right.transform).toBe(`translate(${CHAIR_ART.side.width} 0) scale(-1 1)`);
    expect(right.viewBox).toBe(`0 0 ${CHAIR_ART.side.width} ${CHAIR_ART.side.height}`);
  });
});

describe('the shared pieces', () => {
  it('draws each seat on its walk grid', () => {
    for (const kind of ['chair', 'desk', 'sofa'] as const)
      for (const view of ['front', 'back', 'side'] as const) {
        const drawing = SHARED_SEATING_ART[kind][view];
        expect([drawing.width, drawing.height]).toEqual([
          SEAT_GRIDS[kind][view].width,
          SEAT_GRIDS[kind][view].height,
        ]);
      }
  });

  it('gives every piece that turns its own back and side, bar the rug, whose back is its front', () => {
    for (const kind of ['bookshelf', 'water-cooler', 'coffee-machine', 'rug'] as const) {
      const art = SHARED_OFFICE_ART[kind];
      expect(art.side).not.toBe(art.front);
      if (kind === 'rug') expect(art.back).toBe(art.front);
      else expect(art.back).not.toBe(art.front);
    }
    expect(MEETING_TABLE_ART.side).not.toBe(MEETING_TABLE_ART.front);
    // The plant reads the same from every side.
    expect(SHARED_OFFICE_ART.plant.side).toBe(SHARED_OFFICE_ART.plant.front);
  });

  it('answers a drink on every drawing that shows the machine’s working part', () => {
    expect(MACHINE_ANSWER_AT['water-cooler'].back).toHaveLength(3);
    expect(MACHINE_ANSWER_AT['coffee-machine'].back).toBeNull();
    expect(MACHINE_ANSWER_AT['coffee-machine'].side).toHaveLength(3);
  });
});

describe('turnWithArt', () => {
  it('keeps the centre and scale, takes the turned proportions, and drops a stored rotation', () => {
    const sofa: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      shape: string;
      chairFacing?: 'n' | 'e' | 's' | 'w';
    } = { x: 0, y: 0, width: 136, height: 72, rotation: 30, shape: 'sofa' };
    const art = SHARED_SEATING_ART.sofa;
    const turned = turnWithArt(sofa, art, 'n', 'e');
    expect(turned).not.toHaveProperty('rotation');
    expect(turned.chairFacing).toBe('e');
    expect(turned.shape).toBe('sofa');
    expect(turned.x + turned.width / 2).toBeCloseTo(68);
    expect(turned.y + turned.height / 2).toBeCloseTo(36);
    expect(turned.width / turned.height).toBeCloseTo(art.side.width / art.side.height);
  });

  it('turns a chair in place', () => {
    const chair = { x: 10, y: 20, width: 76, height: 84 };
    expect(turnWithArt(chair, CHAIR_ART, 'n', 'w')).toEqual({ ...chair, chairFacing: 'w' });
  });
});

// livehuddle's office.md "Long Table": the Meeting Table drawn to its length, in all three drawings.
describe('a long table', () => {
  it('draws its front, back and side at the length its box allows, each on its seats', () => {
    const art = longTableArt(560, 168);
    expect(art.front).toMatchObject({ width: 560, height: 168 });
    expect(art.front.seats).toHaveLength(16);
    // From behind it is the front's drawing, its seats turned.
    expect(art.back.parts).toBe(art.front.parts);
    expect(art.back.seats[0]).not.toEqual(art.front.seats[0]);
    // On its side, a tall table as long as the front is wide.
    expect(art.side).toMatchObject({ width: 168, height: 560 });
    expect(art.side.seats).toHaveLength(16);
    expect(art.side.ring).toEqual({ cx: 84, cy: 280, rx: 80, ry: 276 });
    // The same table turned on its side, in its turned box, is the same drawing (cached by length).
    expect(longTableArt(168, 560, 'e')).toBe(art);
    expect(longTableArt(168, 560, 'w')).toBe(art);
  });

  it('keeps only the last few lengths', () => {
    const first = longTableArt(1000, 168);
    for (let w = 1010; w < 1200; w += 10) longTableArt(w, 168);
    expect(longTableArt(1000, 168)).not.toBe(first);
    expect(longTableArt(1000, 168).front.width).toBe(1000);
  });
});
