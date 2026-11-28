import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { isGridOfficeShape, OFFICE_ART } from './office';
import { LAMP_TONES, OFFICE_LAMP_ART } from './office-lamps';
import { turnsWithFacing } from './furniture-facing';
import { isValidElement } from './validate';
import { isSelfDrawingShape } from './data-shapes';
import { SHAPE_KINDS } from './shape-kinds';

// docs/specs/009-elements/office-amenities.md "Lamps"
const KINDS = Object.keys(OFFICE_LAMP_ART) as (keyof typeof OFFICE_LAMP_ART)[];

describe('the lamps', () => {
  it('draws a floor, a table and a desk lamp as wordless grid pieces at their own size', () => {
    expect(KINDS).toEqual(['floor-lamp', 'table-lamp', 'desk-lamp']);
    const sizes = { 'floor-lamp': [48, 136], 'table-lamp': [36, 48], 'desk-lamp': [36, 44] };
    for (const kind of KINDS) {
      expect(SHAPE_KINDS.has(kind), kind).toBe(true);
      expect(isGridOfficeShape(kind), kind).toBe(true);
      expect(isSelfDrawingShape(kind), kind).toBe(true);
      expect(OFFICE_ART[kind]).toBe(OFFICE_LAMP_ART[kind]);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el), kind).toBe(true);
      expect([el.width, el.height], kind).toEqual(sizes[kind]);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('reads the same from every side, so no lamp turns', () => {
    for (const kind of KINDS) {
      const art = OFFICE_ART[kind];
      expect([art.back, art.side], kind).toEqual([art.front, art.front]);
      expect(turnsWithFacing(kind), kind).toBe(false);
    }
  });

  it('lights each shade warm, with a lit rim and a pool of light inside its grid', () => {
    for (const kind of KINDS) {
      const { width, height, parts } = OFFICE_ART[kind].front;
      const fills = parts.map((p) => p.fill);
      expect(fills, kind).toContain(LAMP_TONES.lit);
      const pools = parts.filter((p) => p.role === 'dye');
      expect(pools.length, kind).toBeGreaterThan(0);
      for (const p of pools) {
        expect(p.tag, kind).toBe('ellipse');
        if (p.tag !== 'ellipse') continue;
        expect([LAMP_TONES.pool, LAMP_TONES.poolCore]).toContain(p.fill);
        expect(p.cx - p.rx, kind).toBeGreaterThanOrEqual(0);
        expect(p.cx + p.rx, kind).toBeLessThanOrEqual(width);
        expect(p.cy + p.ry, kind).toBeLessThanOrEqual(height);
      }
      // The pool lies under everything: it is drawn first.
      expect(parts[0]!.role, kind).toBe('dye');
    }
    // The two shades are the warm shade colour; the desk lamp's head takes the theme.
    for (const kind of ['floor-lamp', 'table-lamp'] as const)
      expect(OFFICE_ART[kind].front.parts.map((p) => p.fill)).toContain(LAMP_TONES.shade);
    // The table and desk lamps' bodies take the theme: a panel with no fill of its own.
    for (const kind of ['table-lamp', 'desk-lamp'] as const)
      expect(
        OFFICE_ART[kind].front.parts.some((p) => p.role === 'panel' && !p.fill),
        kind,
      ).toBe(true);
  });
});
