import { describe, expect, it } from 'vitest';
import { FONTS, type Element, type Tab } from '@livedesign/design';
import { PATTERNS } from '@/components/palette/palette-patterns';
import { resolveTheme } from '@/lib/themes';
import {
  LOOKS_PER_PAGE,
  TAB_LOOKS,
  activeLookId,
  suitsFinishedArt,
  tabLookById,
  withLookApplied,
} from './tab-looks';
import { withThemeApplied } from './tab-theme-apply';

// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts over a tab's existing settings.
const shape = (over: Record<string, unknown> = {}): Element => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...over,
});
const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements: [shape()],
  ...over,
});

describe('TAB_LOOKS', () => {
  it('fills two pages of six after the Mashup card, in order, each built only from settings that exist', () => {
    expect(TAB_LOOKS.map((l) => l.label)).toEqual([
      'Everyday',
      'Blueprint',
      'Spectrum',
      'Wireframe',
      'Boardroom',
      'Workshop',
      'Midnight',
      'Daydream',
      'Editorial',
      'Lagoon',
      'Graph Paper',
    ]);
    expect(TAB_LOOKS.length + 1).toBe(LOOKS_PER_PAGE * 2);
    for (const look of TAB_LOOKS) {
      expect(resolveTheme(look.theme), look.id).toBeTruthy();
      expect(
        PATTERNS.some((p) => p.id === look.pattern),
        look.id,
      ).toBe(true);
      if (look.font)
        expect(
          FONTS.some((f) => f.id === look.font),
          look.id,
        ).toBe(true);
    }
  });

  // The ordering rule: Everyday first (after the Mashup card), then a fixed interleave, so the multi-colour looks
  // spread over the pages.
  const multicolour = (id: string) => {
    const theme = resolveTheme(id)!;
    return Boolean(theme.palette?.length || theme.shapeColors);
  };
  // The pages as the carousel shows them: the Mashup card takes the first slot of page one.
  const shown = [null, ...TAB_LOOKS];
  const pages = Array.from({ length: shown.length / LOOKS_PER_PAGE }, (_, i) =>
    shown.slice(i * LOOKS_PER_PAGE, (i + 1) * LOOKS_PER_PAGE).filter((l) => l !== null),
  );

  it('opens on Everyday and has three multi-colour looks, one or two on every page', () => {
    expect(TAB_LOOKS[0]!.id).toBe('everyday');
    expect(TAB_LOOKS.filter((l) => multicolour(l.theme))).toHaveLength(3);
    for (const page of pages) {
      const count = page.filter((l) => multicolour(l.theme)).length;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('never sets two neighbours on a page in the same theme or the same finish', () => {
    for (const page of pages)
      for (let i = 1; i < page.length; i++) {
        const [a, b] = [page[i - 1]!, page[i]!];
        expect(a.theme, `${a.id} | ${b.id}`).not.toBe(b.theme);
        expect(a.finish, `${a.id} | ${b.id}`).not.toBe(b.finish);
      }
  });

  // Every finish is offered; the hand-drawn ones (Sketch, Marker) stay off a logo or a photo page.
  it('offers every finish, one look each drawn by hand, and leaves those off finished art', () => {
    expect(new Set(TAB_LOOKS.map((l) => l.finish))).toEqual(
      new Set(['flexible', 'professional', 'sketch', 'marker']),
    );
    expect(TAB_LOOKS.filter((l) => !suitsFinishedArt(l)).map((l) => l.id)).toEqual([
      'wireframe',
      'workshop',
    ]);
    expect(TAB_LOOKS.map((l) => l.theme)).not.toContain('uml');
  });

  it('gives every look a distinct mix, so at most one reads as selected', () => {
    const keys = TAB_LOOKS.map((l) => [l.theme, l.finish, l.font, l.pattern].join('|'));
    expect(new Set(keys).size).toBe(TAB_LOOKS.length);
  });
});

describe('withLookApplied', () => {
  it('applies the theme exactly as picking it does, then the finish, font and pattern', () => {
    const look = tabLookById('graph-paper')!;
    const out = withLookApplied(tab(), look);
    const themed = withThemeApplied(tab(), 'indigo');
    expect(out.theme).toBe('indigo');
    expect(out.elements).toEqual(themed.elements);
    expect(out.finish).toBe('professional');
    expect(out.font).toBe('roboto-mono');
    expect(out.backgroundPattern).toBe('graph');
  });

  it('clears the tab font for a look without one', () => {
    const out = withLookApplied(tab({ font: 'lora' }), tabLookById('wireframe')!);
    expect('font' in out).toBe(false);
  });

  it('with Element Colours kept, recolours no element yet still takes the theme', () => {
    const own = tab({ elements: [shape({ fill: '#123456' }), shape({ id: 'u' })] });
    const out = withLookApplied(own, tabLookById('graph-paper')!, { keepElementColours: true });
    expect(out.theme).toBe('indigo');
    expect(out.elements).toEqual(own.elements);
  });

  it('then reads as that look', () => {
    for (const look of TAB_LOOKS) expect(activeLookId(withLookApplied(tab(), look))).toBe(look.id);
  });
});

describe('activeLookId', () => {
  it('reads unset settings as what they draw: Default, Flexible, no font, grid', () => {
    expect(activeLookId({})).toBe('everyday');
  });

  it('is undefined once any one setting differs', () => {
    const base = withLookApplied(tab(), tabLookById('midnight')!);
    expect(activeLookId(base)).toBe('midnight');
    expect(activeLookId({ ...base, finish: 'flexible' })).toBeUndefined();
    expect(activeLookId({ ...base, font: 'inter' })).toBeUndefined();
    expect(activeLookId({ ...base, backgroundPattern: 'lines' })).toBeUndefined();
    expect(activeLookId({ ...base, theme: 'rose' })).toBeUndefined();
  });

  it('is undefined for an unknown look id lookup', () => {
    expect(tabLookById('nope')).toBeUndefined();
  });

  it('reads a tab styled with the retired Carnival look as its own mix, nothing migrated', () => {
    expect(tabLookById('carnival')).toBeUndefined();
    const carnival = {
      theme: 'rainbow',
      finish: 'flexible',
      font: 'poppins',
      backgroundPattern: 'confetti',
      backgroundOpacity: 0.5,
    } as const;
    expect(activeLookId(carnival)).toBeUndefined();
  });
});

describe('pattern strength', () => {
  it('counts only for a look that sets one: a template’s softened grid is still Everyday', () => {
    expect(activeLookId({ backgroundOpacity: 0.4 })).toBe('everyday');
    const garden = withLookApplied(tab(), tabLookById('lagoon')!);
    expect(garden.backgroundOpacity).toBe(0.4);
    expect(activeLookId(garden)).toBe('lagoon');
    expect(activeLookId({ ...garden, backgroundOpacity: 1 })).toBeUndefined();
  });

  it('leaves the tab’s own strength alone for a look without one', () => {
    expect(
      withLookApplied(tab({ backgroundOpacity: 0.4 }), tabLookById('everyday')!).backgroundOpacity,
    ).toBe(0.4);
  });
});
