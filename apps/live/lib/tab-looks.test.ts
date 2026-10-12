import { describe, expect, it } from 'vitest';
import { FONTS, type Element, type Tab } from '@livediagram/document';
import { PATTERNS } from '@/components/palette/palette-patterns';
import { resolveTheme } from '@/lib/themes';
import { LOOKS_PER_PAGE, TAB_LOOKS, activeLookId, tabLookById, withLookApplied } from './tab-looks';
import { withThemeApplied } from './tab-theme-apply';

// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts over a tab's existing settings.
const shape = (over: Record<string, unknown> = {}): Element =>
  ({
    id: 's',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    ...over,
  }) as Element;
const tab = (over: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [shape()], ...over }) as Tab;

describe('TAB_LOOKS', () => {
  it('is two pages of six looks, in order, each built only from settings that exist', () => {
    expect(TAB_LOOKS.map((l) => l.label)).toEqual([
      'Everyday',
      'Whiteboard',
      'Graph Paper',
      'Boardroom',
      'Notebook',
      'Midnight',
      'Seaside',
      'Editorial',
      'Engineer',
      'Workshop',
      'Garden',
      'Party',
    ]);
    expect(TAB_LOOKS.length).toBe(LOOKS_PER_PAGE * 2);
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
    const out = withLookApplied(tab({ font: 'lora' }), tabLookById('whiteboard')!);
    expect('font' in out).toBe(false);
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
    const base = withLookApplied(tab(), tabLookById('notebook')!);
    expect(activeLookId(base)).toBe('notebook');
    expect(activeLookId({ ...base, finish: 'flexible' })).toBeUndefined();
    expect(activeLookId({ ...base, font: 'inter' })).toBeUndefined();
    expect(activeLookId({ ...base, backgroundPattern: 'grid' })).toBeUndefined();
    expect(activeLookId({ ...base, theme: 'rose' })).toBeUndefined();
  });

  it('is undefined for an unknown look id lookup', () => {
    expect(tabLookById('nope')).toBeUndefined();
  });
});
