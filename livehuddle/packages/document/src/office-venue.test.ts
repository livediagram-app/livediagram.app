import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createShape } from './shape-factory';
import { isGridOfficeShape, isOfficeShape, OFFICE_ART, poolDeck } from './office';
import { OFFICE_VENUE_ART, POOL_FILL, swimmingPoolParts, VENUE_TONES } from './office-venue';
import { svgBoxed } from './svg-render';
import { isValidElement } from './validate';
import type { FurniturePart } from './seating';

// docs/specs/009-elements/venue-pieces.md
const KINDS = Object.keys(OFFICE_VENUE_ART) as (keyof typeof OFFICE_VENUE_ART)[];

const rectBounds = (p: FurniturePart) =>
  p.tag === 'rect'
    ? { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h }
    : p.tag === 'ellipse'
      ? { x0: p.cx - p.rx, x1: p.cx + p.rx, y0: p.cy - p.ry, y1: p.cy + p.ry }
      : null;
// Every number a path names, read as x, y pairs (checked on the paths of absolute points only).
const pathNumbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('the venue pieces', () => {
  it('draws the six grid pieces at their own size, wordless, aspect locked', () => {
    expect(KINDS).toEqual([
      'pillar',
      'column',
      'car-park',
      'bike-rack',
      'stage-curtains',
      'podium',
    ]);
    for (const kind of KINDS) {
      expect(isGridOfficeShape(kind), kind).toBe(true);
      const art = OFFICE_ART[kind].front;
      expect(art).toBe(OFFICE_VENUE_ART[kind].front);
      // The pillar, the column and the curtains read the same from every side; the rest turn (furniture-facing.md).
      if (kind === 'pillar' || kind === 'column' || kind === 'stage-curtains') {
        expect(OFFICE_ART[kind].back).toBe(art);
        expect(OFFICE_ART[kind].side).toBe(art);
      }
      expect(art.seats, kind).toEqual([]);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect([el.width, el.height], kind).toEqual([art.width, art.height]);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('keeps every part inside its grid', () => {
    for (const kind of KINDS) {
      const { width, height, parts } = OFFICE_ART[kind].front;
      for (const p of parts) {
        const b = rectBounds(p);
        if (b) {
          expect(b.x0, kind).toBeGreaterThanOrEqual(-1);
          expect(b.x1, kind).toBeLessThanOrEqual(width + 1);
          expect(b.y0, kind).toBeGreaterThanOrEqual(-1);
          expect(b.y1, kind).toBeLessThanOrEqual(height + 1);
        } else if (p.tag === 'path' && !/[aqhv]/i.test(p.d)) {
          const ns = pathNumbers(p.d);
          for (let i = 0; i + 1 < ns.length; i += 2) {
            expect(ns[i], `${kind} ${p.d}`).toBeLessThanOrEqual(width + 1);
            expect(ns[i + 1], `${kind} ${p.d}`).toBeLessThanOrEqual(height + 1);
          }
        }
      }
    }
  });

  it('mirrors the right drape of the stage curtains from the left, open in the middle', () => {
    const parts = OFFICE_ART['stage-curtains'].front.parts;
    const velvet = parts.filter(
      (p) => p.tag === 'path' && p.role === 'panel' && p.fill === VENUE_TONES.velvet,
    );
    // The two drapes and the pelmet.
    expect(velvet).toHaveLength(3);
    const [left, right] = velvet as Extract<FurniturePart, { tag: 'path' }>[];
    expect(
      pathNumbers(left!.d)
        .filter((_, i) => i % 2 === 0)
        .every((x) => x <= 68),
    ).toBe(true);
    expect(
      pathNumbers(right!.d)
        .filter((_, i) => i % 2 === 0)
        .every((x) => x >= 360 - 68),
    ).toBe(true);
  });

  it('is an office kind the canvas and the export both paint', () => {
    for (const kind of [...KINDS, 'swimming-pool'] as const) {
      expect(isOfficeShape(kind), kind).toBe(true);
      const svg = svgBoxed(createShape(kind, 0, 0), { surface: 'light' });
      expect(svg, kind).toMatch(/<(path|rect|ellipse)\b/);
    }
  });
});

describe('the swimming pool', () => {
  it('is placed resizable at 320 × 200, wordless, its water the fill', () => {
    const el = createShape('swimming-pool', 0, 0);
    expect(isGridOfficeShape('swimming-pool')).toBe(false);
    expect([el.width, el.height]).toEqual([320, 200]);
    expect(el.label).toBe('');
    expect(el.aspectLocked).toBeFalsy();
    expect(svgBoxed(el, { surface: 'light' })).toContain(`fill="${POOL_FILL}"`);
  });

  it('draws its water inside the deck the walk uses, so the water drawn is the water that blocks', () => {
    for (const [w, h] of [
      [320, 200],
      [600, 200],
      [120, 90],
      [40, 300],
    ] as const) {
      const water = swimmingPoolParts(w, h).find((p) => p.role === 'floor')!;
      const d = poolDeck(w, h);
      expect(water, `${w}x${h}`).toMatchObject({
        tag: 'rect',
        x: d,
        y: d,
        w: w - 2 * d,
        h: h - 2 * d,
      });
    }
  });

  it('runs a lane of floats down a long pool and its stripes along a tall one, and keeps a small one plain', () => {
    const marks = (w: number, h: number) =>
      swimmingPoolParts(w, h).filter((p) => p.role === 'mark') as Extract<
        FurniturePart,
        { tag: 'path' }
      >[];
    const fills = (w: number, h: number) => marks(w, h).map((p) => p.fill);
    expect(fills(320, 200)).toEqual([VENUE_TONES.lane, VENUE_TONES.float, VENUE_TONES.floatWhite]);
    expect(fills(120, 90)).toEqual([VENUE_TONES.lane]);
    // A tall pool lays its stripes and floats down its height.
    const [stripes] = marks(200, 400);
    expect(stripes!.d.startsWith('M')).toBe(true);
    expect(stripes!.d).toContain('v');
    expect(fills(200, 400)).toContain(VENUE_TONES.float);
    // A tiny pool draws its deck and water alone; one of no size draws nothing.
    expect(fills(4, 4)).toEqual([]);
    expect(swimmingPoolParts(0, 100)).toEqual([]);
    // Only a pool wide enough has its ladder.
    expect(swimmingPoolParts(320, 200).some((p) => p.role === 'line')).toBe(true);
    expect(swimmingPoolParts(80, 60).some((p) => p.role === 'line')).toBe(false);
  });

  it('draws a vast pool in a fixed handful of shapes, quickly', () => {
    expect(swimmingPoolParts(20000, 8000).length).toBeLessThanOrEqual(10);
    expect(cpuMsOf(() => swimmingPoolParts(20000, 8000))).toBeLessThan(cpuBudgetMs(20));
  });
});
