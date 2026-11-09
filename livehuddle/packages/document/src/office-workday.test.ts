import { describe, expect, it } from 'vitest';
import {
  HOT_DESK_SEATS,
  NAP_POD_SEATS,
  PHONE_BOOTH_SEATS,
  STANDING_DESK_SEATS,
  TREADMILL_SEATS,
  WEIGHT_BENCH_SEATS,
} from '@livehuddle/avatar/seats';
import { createShape } from './shape-factory';
import { isGridOfficeShape, OFFICE_ART } from './office';
import {
  HOT_DESK_CARD,
  HOT_DESK_CARDS,
  OFFICE_WORKDAY_ART,
  PHONE_BOOTH_LAMP,
  RECEPTION_BELL,
  RECEPTION_BELLS,
  TREADMILL_BELT,
  TREADMILL_BELTS,
} from './office-workday';
import { SEAT_VIEWS } from '@livehuddle/avatar/seats';
import { footprintFraction } from '@livehuddle/avatar/office-geometry';
import { facingView } from '@livehuddle/avatar/facing';
import { pieceFacing, turnsWithFacing } from './furniture-facing';
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
  it('are eight grid pieces at their own size, wordless, aspect locked, drawn as they always were', () => {
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
    // The drawing an unturned piece shows: the front, or the back for those whose sitter faces up at what they use.
    const unturned = (k: (typeof KINDS)[number]) =>
      OFFICE_ART[k][facingView(pieceFacing({ shape: k })).view];
    const sizes = KINDS.map((k) => [unturned(k).width, unturned(k).height]);
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
      const art = unturned(kind);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect([el.width, el.height], kind).toEqual([art.width, art.height]);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('seats one on each seat piece, where the walk seats them, and none on the bed or the desk', () => {
    for (const kind of KINDS) {
      const { seats } = OFFICE_ART[kind][facingView(pieceFacing({ shape: kind })).view];
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

  it('draws every piece but the round bed three ways, each seat on its cushion in every drawing', () => {
    for (const kind of KINDS) {
      const art = OFFICE_ART[kind];
      if (kind === 'pet-bed') {
        expect(turnsWithFacing(kind)).toBe(false);
        expect(art.back).toBe(art.front);
        expect(art.side).toBe(art.front);
        continue;
      }
      expect(turnsWithFacing(kind), kind).toBe(true);
      expect(new Set([art.front, art.back, art.side]).size, kind).toBe(3);
      const views = SEAT_VIEWS[kind as keyof typeof SEAT_VIEWS];
      for (const view of ['front', 'back', 'side'] as const) {
        const d = art[view];
        // Every part on its grid, the shadow at its foot.
        for (const p of d.parts) {
          const b = bounds(p);
          if (!b) continue;
          expect(b.x0, `${kind} ${view}`).toBeGreaterThanOrEqual(-1);
          expect(b.x1, `${kind} ${view}`).toBeLessThanOrEqual(d.width + 1);
          expect(b.y0, `${kind} ${view}`).toBeGreaterThanOrEqual(-1);
          expect(b.y1, `${kind} ${view}`).toBeLessThanOrEqual(d.height + 1);
        }
        const shadow = d.parts[0]!;
        expect(shadow.role, `${kind} ${view}`).toBe('shadow');
        expect(shadow.tag === 'ellipse' && shadow.cy > d.height * 0.8, `${kind} ${view}`).toBe(
          true,
        );
        if (!views) {
          expect(d.seats, kind).toEqual([]);
          continue;
        }
        // The seat the walk uses on this drawing is the one drawn, on its grid.
        expect([d.width, d.height], `${kind} ${view}`).toEqual([
          views[view].width,
          views[view].height,
        ]);
        expect(d.seats, `${kind} ${view}`).toEqual(views[view].seats);
        expect(d.ringUnder ?? 0, `${kind} ${view}`).toBeLessThanOrEqual(d.parts.length);
      }
    }
  });

  it('turns a long piece onto its side long down the canvas, and a square one in place', () => {
    const aspect = (d: { width: number; height: number }) => d.width / d.height;
    for (const kind of [
      'treadmill',
      'weight-bench',
      'standing-desk',
      'hot-desk',
      'nap-pod',
    ] as const)
      expect(OFFICE_ART[kind].side.width, kind).toBe(OFFICE_ART[kind].front.height);
    expect(aspect(OFFICE_ART['reception-desk'].side)).toBeLessThan(1);
    expect(aspect(OFFICE_ART['reception-desk'].front)).toBeGreaterThan(1);
    // A booth stands on a square floor: it turns in its own box.
    expect(OFFICE_ART['phone-booth'].side).toMatchObject({ width: 80, height: 136 });
  });

  it('lays each live part on the drawing it belongs to', () => {
    const inGrid = (
      kind: keyof typeof OFFICE_WORKDAY_ART,
      view: 'front' | 'back' | 'side',
      r: { x: number; y: number; w: number; h: number },
    ) => {
      const { width, height } = OFFICE_ART[kind][view];
      expect(
        r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height,
        `${kind} ${view}`,
      ).toBe(true);
    };
    for (const view of ['front', 'back', 'side'] as const) {
      inGrid('treadmill', view, TREADMILL_BELTS[view]);
      inGrid('phone-booth', view, PHONE_BOOTH_LAMP);
      inGrid('hot-desk', view, HOT_DESK_CARDS[view]);
      const bell = RECEPTION_BELLS[view];
      inGrid('reception-desk', view, { x: bell.cx - 10, y: bell.cy - 10, w: 20, h: 20 });
      // The bell is drawn where it rings: its dome's button at the spot.
      expect(
        OFFICE_ART['reception-desk'][view].parts.some(
          (p) => p.tag === 'ellipse' && p.cx === bell.cx && p.cy === bell.cy - 5.5,
        ),
        view,
      ).toBe(true);
    }
    // The unturned spots are the ones the editor always had.
    expect(TREADMILL_BELT).toBe(TREADMILL_BELTS.back);
    expect(HOT_DESK_CARD).toBe(HOT_DESK_CARDS.back);
    expect(RECEPTION_BELL).toBe(RECEPTION_BELLS.front);
  });

  it('blocks with the reception counter on its side down its whole length', () => {
    const side = footprintFraction('reception-desk', 'e')!;
    expect(side.y1 - side.y0).toBeGreaterThan(0.7);
    expect(footprintFraction('reception-desk', 'w')).toEqual({
      x0: 1 - side.x1,
      x1: 1 - side.x0,
      y0: side.y0,
      y1: side.y1,
    });
    expect(footprintFraction('reception-desk', 's')).toEqual(
      footprintFraction('reception-desk', 'n'),
    );
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
