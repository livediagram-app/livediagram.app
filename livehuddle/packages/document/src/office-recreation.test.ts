import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isGridOfficeShape, OFFICE_ART } from './office';
import {
  glowsAtNight,
  NIGHT_GLOW,
  OFFICE_RECREATION_ART,
  RECREATION_TONES,
} from './office-recreation';
import { isValidElement } from './validate';

// docs/specs/009-elements/social-pieces.md "Pool Table, Foosball Table, Dartboard", "Vending Machine",
// "Bean Bag, Reading Nook".
const KINDS = Object.keys(OFFICE_RECREATION_ART) as (keyof typeof OFFICE_RECREATION_ART)[];

// Every number a part's geometry names, so a drawing can be held inside its grid.
function partBounds(p: (typeof OFFICE_ART)['dartboard']['front']['parts'][number]) {
  if (p.tag === 'rect') return { x0: p.x, x1: p.x + p.w, y0: p.y, y1: p.y + p.h };
  if (p.tag === 'ellipse')
    return { x0: p.cx - p.rx, x1: p.cx + p.rx, y0: p.cy - p.ry, y1: p.cy + p.ry };
  return null;
}

describe('the second set of social pieces', () => {
  it('draws all six as grid pieces at their own size, with no words, aspect locked', () => {
    expect(KINDS).toEqual([
      'pool-table',
      'foosball-table',
      'dartboard',
      'vending-machine',
      'bean-bag',
      'reading-nook',
    ]);
    for (const kind of KINDS) {
      expect(isGridOfficeShape(kind), kind).toBe(true);
      const art = OFFICE_ART[kind].front;
      expect(art).toBe(OFFICE_RECREATION_ART[kind].front);
      expect(OFFICE_ART[kind].back).toBe(art);
      expect(OFFICE_ART[kind].side).toBe(art);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect(el.width, kind).toBe(art.width);
      expect(el.height, kind).toBe(art.height);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('keeps every rect and ellipse inside its grid', () => {
    for (const kind of KINDS) {
      const { width, height, parts } = OFFICE_ART[kind].front;
      for (const p of parts) {
        const b = partBounds(p);
        if (!b) continue;
        expect(b.x0, kind).toBeGreaterThanOrEqual(0);
        expect(b.y0, kind).toBeGreaterThanOrEqual(0);
        expect(b.x1, kind).toBeLessThanOrEqual(width);
        expect(b.y1, kind).toBeLessThanOrEqual(height);
      }
    }
  });

  it('seats one in a bean bag and one in the reading nook, and nobody at the games', () => {
    expect(OFFICE_ART['bean-bag'].front.seats).toHaveLength(1);
    expect(OFFICE_ART['reading-nook'].front.seats).toHaveLength(1);
    for (const kind of ['pool-table', 'foosball-table', 'dartboard', 'vending-machine'] as const)
      expect(OFFICE_ART[kind].front.seats, kind).toEqual([]);
    // The ring lies on the seat, under the nook's arms.
    const nook = OFFICE_ART['reading-nook'].front;
    expect(nook.ringUnder).toBeLessThan(nook.parts.length);
  });

  it('paints the dartboard ring by ring: ten segments a set, the black ones from 20 at the top', () => {
    const marks = OFFICE_ART.dartboard.front.parts.filter(
      (p) => p.tag === 'path' && p.role === 'mark' && p.fill === RECREATION_TONES.sisal,
    );
    expect(marks).toHaveLength(2);
    for (const m of marks) if (m.tag === 'path') expect(m.d.match(/Z/g)).toHaveLength(10);
    // Segment 20 straddles the top: its first wedge's edges sit either side of the centre line.
    const first = marks[0]!.tag === 'path' ? marks[0]!.d : '';
    const [, x0, , x1] = /L([\d.]+) ([\d.]+)A[\d.]+ [\d.]+ 0 0 1 ([\d.]+)/.exec(first) ?? [];
    expect(Number(x0)).toBeLessThan(40);
    expect(Number(x1)).toBeGreaterThan(40);
  });

  it('gives the vending machine one part per can colour', () => {
    const fills = OFFICE_ART['vending-machine'].front.parts
      .filter((p) => p.role === 'mark' && p.tag === 'path')
      .map((p) => p.fill);
    for (const can of RECREATION_TONES.cans) expect(fills).toContain(can);
  });

  it('names a night glow for the lit pieces only, inside reach of their grid', () => {
    expect(glowsAtNight('vending-machine')).toBe(true);
    expect(glowsAtNight('reading-nook')).toBe(true);
    for (const kind of ['jukebox', 'pool-table', 'bean-bag', 'dartboard'])
      expect(glowsAtNight(kind), kind).toBe(false);
    for (const kind of ['vending-machine', 'reading-nook'] as const) {
      const { width, height } = OFFICE_ART[kind].front;
      const { pool, halo } = NIGHT_GLOW[kind];
      for (const e of [pool, halo]) {
        expect(e.cx, kind).toBeGreaterThan(0);
        expect(e.cx, kind).toBeLessThan(width);
        expect(e.cy, kind).toBeLessThanOrEqual(height);
      }
    }
  });
});
