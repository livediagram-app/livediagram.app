import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, newLogoPage, newSlidePage } from './illustrate-page';
import { logoGuides, logoPageAt, logoPageSnapBoxes } from './logo-page';

// docs/specs/007-editor/logo-pages.md "Construction guides".
describe('logo construction guides', () => {
  const rect = { x: -512, y: -512, width: 1024, height: 1024 };

  it('cross at the centre and run corner to corner', () => {
    const g = logoGuides(rect);
    expect(g.centre.v).toEqual({ x1: 0, y1: -512, x2: 0, y2: 512 });
    expect(g.centre.h).toEqual({ x1: -512, y1: 0, x2: 512, y2: 0 });
    expect(g.diagonals[0]).toEqual({ x1: -512, y1: -512, x2: 512, y2: 512 });
  });

  it('inset the safe area 10% and inscribe the keyline circle in it', () => {
    const g = logoGuides(rect);
    expect(g.safeArea).toEqual({ x: -410, y: -410, width: 820, height: 820 });
    expect(g.keylineCircle).toEqual({ cx: 0, cy: 0, r: 409.6 });
    expect(g.innerCircle.r).toBe(256);
    expect(g.keylineSquare.width).toBeCloseTo(655.36);
    expect(g.keylineSquare.x + g.keylineSquare.width / 2).toBe(0);
  });

  it('divide the artboard into an 8 x 8 grid (seven inner lines each way)', () => {
    const g = logoGuides(rect);
    expect(g.grid).toHaveLength(14);
    expect(g.grid[0]).toEqual({ x1: -384, y1: -512, x2: -384, y2: 512 });
  });

  it('snap to the inner circle and the keyline square of logo pages only', () => {
    const pages = layOutIllustratePages([newSlidePage('s'), newLogoPage('l')]);
    const boxes = logoPageSnapBoxes(pages);
    expect(boxes.map((b) => b.id)).toEqual(['logo-inner:l', 'logo-keyline:l']);
    const l = pages[1]!;
    const cx = l.rect.x + 512;
    expect(boxes[0]).toMatchObject({ x: cx - 256, y: -256, width: 512, height: 512 });
  });

  it('finds the logo page under a point', () => {
    const pages = layOutIllustratePages([newSlidePage('s'), newLogoPage('l')]);
    expect(logoPageAt(pages, { x: 0, y: 0 })).toBeUndefined();
    expect(logoPageAt(pages, { x: pages[1]!.rect.x + 10, y: 0 })?.id).toBe('l');
  });
});
