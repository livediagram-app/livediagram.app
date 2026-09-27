import { describe, expect, it } from 'vitest';
import {
  QUICK_SWATCH_SLOTS,
  isQuickSwatchSlot,
  quickSwatchColor,
  quickSwatches,
  quickSwatchSlotOf,
} from './quick-swatches';
import { contrastRatio } from './colors';
import { DEFAULT_SCHEME_DARK, DEFAULT_SCHEME_LIGHT, THEMES } from './themes-data';
import type { ThemeDefinition } from './themes';

// docs/specs/008-canvas/quick-style-panel.md "Colours".

const theme = (id: string): ThemeDefinition => THEMES.find((t) => t.id === id)!;
const SINGLE_ACCENT = [...THEMES, DEFAULT_SCHEME_DARK].filter((t) => !t.palette);
const MULTI_COLOUR = THEMES.filter((t) => t.palette);

describe('quickSwatches', () => {
  it('offers seven swatches per role: the theme default, then slots 1 to 6', () => {
    for (const t of [...THEMES, DEFAULT_SCHEME_DARK]) {
      for (const role of ['stroke', 'fill'] as const) {
        const swatches = quickSwatches(t, role);
        expect(swatches.map((s) => s.slot)).toEqual([0, ...QUICK_SWATCH_SLOTS]);
      }
    }
  });

  it('leads with the theme default, which writes nothing of its own', () => {
    const [first] = quickSwatches(theme('forest'), 'fill');
    expect(first).toMatchObject({ slot: 0, name: 'Theme default', color: '#dcfce7' });
  });

  it('shows the unpainted ink as the default on the Default scheme', () => {
    expect(quickSwatches(DEFAULT_SCHEME_LIGHT, 'stroke')[0]!.color).toBe('#0ea5e9');
    expect(quickSwatches(DEFAULT_SCHEME_DARK, 'stroke')[0]!.color).toBe('#a1a1aa');
  });

  it('takes a multi-colour theme’s own six branch colours', () => {
    const rainbow = theme('rainbow');
    expect(
      quickSwatches(rainbow, 'stroke')
        .slice(1)
        .map((s) => s.color),
    ).toEqual(rainbow.palette!.map((p) => p.stroke));
    expect(
      quickSwatches(rainbow, 'fill')
        .slice(1)
        .map((s) => s.color),
    ).toEqual(rainbow.palette!.map((p) => p.fill));
  });

  it('spins a single-accent theme into six named hues in the accent’s tone', () => {
    const names = quickSwatches(theme('forest'), 'stroke')
      .slice(1)
      .map((s) => s.name);
    expect(names).toEqual(['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet']);
  });

  it('gives every swatch in a row a distinct colour', () => {
    for (const t of [...THEMES, DEFAULT_SCHEME_DARK]) {
      for (const role of ['stroke', 'fill'] as const) {
        const colours = quickSwatches(t, role).map((s) => s.color.toLowerCase());
        expect(new Set(colours).size, `${t.id} ${role}`).toBe(7);
      }
    }
  });

  it('keeps a derived stroke visible on its canvas (WCAG 1.4.11, 3:1)', () => {
    for (const t of SINGLE_ACCENT) {
      for (const s of quickSwatches(t, 'stroke').slice(1)) {
        expect(
          contrastRatio(s.color, t.backgroundColor),
          `${t.id} ${s.name}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps the theme’s label readable on a derived background (WCAG 1.4.3, 4.5:1)', () => {
    for (const t of SINGLE_ACCENT) {
      const text = t.elementText ?? (t === DEFAULT_SCHEME_DARK ? '#e4e4e7' : '#075985');
      for (const s of quickSwatches(t, 'fill').slice(1)) {
        expect(contrastRatio(text, s.color), `${t.id} ${s.name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('names a multi-colour theme’s swatches by their hue, never twice in a row', () => {
    for (const t of MULTI_COLOUR) {
      const names = quickSwatches(t, 'stroke').map((s) => s.name);
      for (const name of names.slice(1)) expect(name).toMatch(/^[A-Z][a-z]+( [a-z0-9]+)?$/);
      expect(new Set(names).size, t.id).toBe(7);
    }
    expect(quickSwatches(theme('rainbow'), 'stroke')[4]!.name).toBe('Green');
  });
});

describe('quickSwatchColor', () => {
  it('resolves a slot for another theme, which is how a bound colour follows a theme change', () => {
    const inForest = quickSwatchColor(theme('forest'), 'stroke', 1);
    const inOcean = quickSwatchColor(theme('ocean'), 'stroke', 1);
    expect(inForest).not.toBe(inOcean);
    expect(quickSwatches(theme('ocean'), 'stroke')[1]!.color).toBe(inOcean);
  });
});

describe('quickSwatchSlotOf', () => {
  it('finds the slot a colour sits in, case-insensitively', () => {
    const colour = quickSwatchColor(theme('forest'), 'fill', 4);
    expect(quickSwatchSlotOf(theme('forest'), 'fill', colour.toUpperCase())).toBe(4);
  });

  it('answers null for a colour that is not one of the six', () => {
    expect(quickSwatchSlotOf(theme('forest'), 'fill', '#123456')).toBeNull();
    expect(quickSwatchSlotOf(theme('forest'), 'fill', undefined)).toBeNull();
  });
});

describe('isQuickSwatchSlot', () => {
  it('accepts 1 to 6 and nothing else', () => {
    expect(QUICK_SWATCH_SLOTS.every(isQuickSwatchSlot)).toBe(true);
    for (const bad of [0, 7, 1.5, '1', null, undefined]) expect(isQuickSwatchSlot(bad)).toBe(false);
  });
});
