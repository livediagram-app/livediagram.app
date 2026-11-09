import { describe, expect, it } from 'vitest';
import { SEAT_VIEWS } from '@livehuddle/avatar/seats';
import { OFFICE_ART } from './office';
import type { FurnitureDrawing, FurniturePart } from './seating';
import {
  ARCADE_SCREEN_SIDE,
  FIREPLACE_FLAMES_SIDE,
  JUKEBOX_ARCH_SIDE,
  PING_PONG_TOP,
  PING_PONG_TOP_SIDE,
} from './office-social';
import { NIGHT_GLOW, nightGlowIn } from './office-recreation';
import { turnPiece } from './furniture-facing';
import { createShape } from './shape-factory';

// docs/specs/009-elements/social-pieces.md and furniture-facing.md: the social pieces with live faces, turned.

const KINDS = [
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'vending-machine',
  'reading-nook',
] as const;

// Every number a path draws through, in pairs, for the bounds check.
const pathNumbers = (d: string) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

// A part's box on its grid (a path is checked only for an absolute path's numbers, which is all these use).
function inGrid(part: FurniturePart, view: FurnitureDrawing): boolean {
  const W = view.width + 1;
  const H = view.height + 1;
  if (part.tag === 'rect')
    return part.x >= -1 && part.y >= -1 && part.x + part.w <= W && part.y + part.h <= H;
  if (part.tag === 'ellipse') return part.cx >= 0 && part.cx <= W && part.cy >= 0 && part.cy <= H;
  if (/[a-z]/.test(part.d.replace(/[MLHVCZQ]/g, ''))) return true;
  return pathNumbers(part.d).every((n) => n >= -1 && n <= Math.max(W, H));
}

describe('the social pieces with live faces, turned', () => {
  it('draws a back and a side of their own for each, on whole-number grids within them', () => {
    for (const kind of KINDS) {
      const art = OFFICE_ART[kind];
      expect(art.back, kind).not.toBe(art.front);
      expect(art.side, kind).not.toBe(art.front);
      for (const view of [art.back, art.side]) {
        expect(Number.isInteger(view.width) && Number.isInteger(view.height), kind).toBe(true);
        for (const part of view.parts)
          expect(inGrid(part, view), `${kind} ${JSON.stringify(part)}`).toBe(true);
        // The contact shadow, where there is one, lies under the piece: in its lowest tenth.
        const shadow = view.parts.find((p) => p.role === 'shadow');
        if (shadow?.tag === 'ellipse') expect(shadow.cy, kind).toBeGreaterThan(view.height * 0.9);
        if (view.ringUnder !== undefined) expect(view.ringUnder).toBeLessThan(view.parts.length);
      }
    }
  });

  it('keeps the cabinets narrow on their side, and lays the table and the nook on theirs', () => {
    for (const kind of ['jukebox', 'arcade-machine', 'fireplace', 'vending-machine'] as const) {
      const art = OFFICE_ART[kind];
      expect(art.side.width, kind).toBeLessThan(art.front.width);
      expect(art.side.height, kind).toBe(art.front.height);
      expect([art.back.width, art.back.height], kind).toEqual([art.front.width, art.front.height]);
    }
    for (const kind of ['ping-pong-table', 'reading-nook'] as const) {
      const art = OFFICE_ART[kind];
      expect([art.side.width, art.side.height], kind).toEqual([art.front.height, art.front.width]);
    }
  });

  it('seats the ping-pong table and the nook on the same grids the seats are read from', () => {
    for (const kind of ['ping-pong-table', 'reading-nook'] as const) {
      const art = OFFICE_ART[kind];
      const views = SEAT_VIEWS[kind];
      for (const name of ['front', 'back', 'side'] as const) {
        expect([art[name].width, art[name].height], `${kind} ${name}`).toEqual([
          views[name].width,
          views[name].height,
        ]);
        expect(art[name].seats, `${kind} ${name}`).toEqual(views[name].seats);
      }
    }
  });

  it('turns a placed piece into its side drawing’s proportions, keeping its centre', () => {
    const table = createShape('ping-pong-table', 100, 100);
    const turned = turnPiece(table, 'e');
    expect(turned.width / turned.height).toBeCloseTo(112 / 184);
    expect(turned.x + turned.width / 2).toBeCloseTo(table.x + table.width / 2);
    expect(turned.y + turned.height / 2).toBeCloseTo(table.y + table.height / 2);
  });

  it('names where the live faces lie on the turned drawings, inside them', () => {
    const side = (kind: (typeof KINDS)[number]) => OFFICE_ART[kind].side;
    const t = PING_PONG_TOP_SIDE;
    expect(t.x + t.w).toBeLessThanOrEqual(side('ping-pong-table').width);
    expect(t.y + t.h).toBeLessThanOrEqual(side('ping-pong-table').height);
    // The table top is the front's turned: its length now runs down, as long as the front's runs across... near enough.
    expect(t.h).toBeGreaterThan(t.w);
    expect(Math.abs(t.h - PING_PONG_TOP.w)).toBeLessThan(16);
    for (const [kind, d] of [
      ['arcade-machine', ARCADE_SCREEN_SIDE],
      ['jukebox', JUKEBOX_ARCH_SIDE],
    ] as const)
      for (const n of pathNumbers(d)) expect(n, kind).toBeLessThanOrEqual(side(kind).width + 48);
    // The live strips lie down the front's strip on the left of the side drawing.
    expect(Math.min(...pathNumbers(ARCADE_SCREEN_SIDE).filter((_, i) => i % 2 === 0))).toBeLessThan(
      20,
    );
    expect(FIREPLACE_FLAMES_SIDE.cx).toBeLessThan(side('fireplace').width / 2);
    expect(FIREPLACE_FLAMES_SIDE.base).toBeLessThan(side('fireplace').height);
  });

  it('glows the vending machine only where its window shows, and the nook’s lamp from every side', () => {
    expect(nightGlowIn('vending-machine', 'front')).toBe(NIGHT_GLOW['vending-machine']);
    expect(nightGlowIn('vending-machine', 'back')).toBeNull();
    const vending = nightGlowIn('vending-machine', 'side')!;
    expect(vending.halo.cx).toBeLessThan(OFFICE_ART['vending-machine'].side.width / 2);
    for (const view of ['back', 'side'] as const) {
      const glow = nightGlowIn('reading-nook', view)!;
      const grid = OFFICE_ART['reading-nook'][view];
      expect(glow.color).toBe(NIGHT_GLOW['reading-nook'].color);
      for (const e of [glow.pool, glow.halo]) {
        expect(e.cx).toBeGreaterThan(0);
        expect(e.cx).toBeLessThan(grid.width);
        expect(e.cy).toBeLessThanOrEqual(grid.height);
      }
    }
    // From behind the nook is mirrored: the lamp on the left.
    expect(nightGlowIn('reading-nook', 'back')!.halo.cx).toBeLessThan(80);
  });
});
