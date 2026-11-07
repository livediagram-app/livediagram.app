import { describe, expect, it } from 'vitest';
import {
  HOT_DESK_SEATS,
  NAP_POD_SEATS,
  PHONE_BOOTH_SEATS,
  STANDING_DESK_SEATS,
  TREADMILL_SEATS,
  WEIGHT_BENCH_SEATS,
} from '@liveworkspace/avatar/seats';
import { createShape } from './shape-factory';
import { isGridOfficeShape, OFFICE_ART } from './office';
import {
  HOT_DESK_CARD,
  OFFICE_WORKDAY_ART,
  PHONE_BOOTH_LAMP,
  RECEPTION_BELL,
  TREADMILL_BELT,
} from './office-workday';
import { svgBoxed } from './svg-render';
import { isValidElement } from './validate';
import type { FurniturePart } from './seating';

// docs/specs/009-elements/workday-pieces.md
const KINDS = Object.keys(OFFICE_WORKDAY_ART) as (keyof typeof OFFICE_WORKDAY_ART)[];
const SEATED: Record<string, { seats: readonly { u: number; v: number }[] }> = {
  'nap-pod': NAP_POD_SEATS,
  treadmill: TREADMILL_SEATS,
  'weight-bench': WEIGHT_BENCH_SEATS,
  'phone-booth': PHONE_BOOTH_SEATS,
  'standing-desk': STANDING_DESK_SEATS,
  'hot-desk': HOT_DESK_SEATS,
};

const bounds = (p: FurniturePart) =>
  p.tag === 'rect'
    ? { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h }
    : p.tag === 'ellipse'
      ? { x0: p.cx - p.rx, x1: p.cx + p.rx, y0: p.cy - p.ry, y1: p.cy + p.ry }
      : null;

describe('the workday pieces', () => {
  it('are eight grid pieces at their own size, wordless, aspect locked, the same from every side', () => {
    expect(KINDS).toEqual([
      'nap-pod',
      'treadmill',
      'weight-bench',
      'phone-booth',
      'standing-desk',
      'hot-desk',
      'pet-bed',
      'reception-desk',
    ]);
    const sizes = KINDS.map((k) => [OFFICE_ART[k].front.width, OFFICE_ART[k].front.height]);
    expect(sizes).toEqual([
      [120, 112],
      [72, 112],
      [136, 88],
      [80, 136],
      [112, 104],
      [120, 112],
      [72, 48],
      [200, 112],
    ]);
    for (const kind of KINDS) {
      expect(isGridOfficeShape(kind), kind).toBe(true);
      const art = OFFICE_ART[kind].front;
      expect(OFFICE_ART[kind].back, kind).toBe(art);
      expect(OFFICE_ART[kind].side, kind).toBe(art);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect([el.width, el.height], kind).toEqual([art.width, art.height]);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('seats one on each seat piece, where the walk seats them, and none on the bed or the desk', () => {
    for (const kind of KINDS) {
      const { seats } = OFFICE_ART[kind].front;
      const grid = SEATED[kind];
      if (!grid) {
        expect(seats, kind).toEqual([]);
        continue;
      }
      expect(seats, kind).toHaveLength(1);
      expect(seats, kind).toEqual(grid.seats.map(({ u, v }) => ({ u, v })));
    }
  });

  it('keeps every part, and every live part, inside its grid', () => {
    for (const kind of KINDS) {
      const { width, height, parts } = OFFICE_ART[kind].front;
      for (const p of parts) {
        const b = bounds(p);
        if (!b) continue;
        expect(b.x0, kind).toBeGreaterThanOrEqual(-1);
        expect(b.x1, kind).toBeLessThanOrEqual(width + 1);
        expect(b.y0, kind).toBeGreaterThanOrEqual(-1);
        expect(b.y1, kind).toBeLessThanOrEqual(height + 1);
      }
    }
    const inGrid = (
      kind: keyof typeof OFFICE_WORKDAY_ART,
      r: { x: number; y: number; w: number; h: number },
    ) => {
      const { width, height } = OFFICE_ART[kind].front;
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height, kind).toBe(true);
    };
    inGrid('treadmill', TREADMILL_BELT);
    inGrid('phone-booth', PHONE_BOOTH_LAMP);
    inGrid('hot-desk', HOT_DESK_CARD);
    inGrid('reception-desk', {
      x: RECEPTION_BELL.cx - 10,
      y: RECEPTION_BELL.cy - 10,
      w: 20,
      h: 20,
    });
  });

  it('exports each one as drawn art', () => {
    for (const kind of KINDS) {
      const svg = svgBoxed(createShape(kind, 0, 0), { surface: 'light' });
      expect(svg, kind).toMatch(/<(path|rect|ellipse)\b/);
      expect(svgBoxed(createShape(kind, 0, 0), { surface: 'dark' }), kind).toMatch(
        /<(path|rect|ellipse)\b/,
      );
    }
  });
});
