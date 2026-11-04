import { describe, expect, it } from 'vitest';
import { FONTS, type Tab } from '@liveplanner/project';
import { withLookApplied, TAB_LOOKS } from '@/lib/tab-looks';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { withTabTextSize } from '@/lib/tab-style-transforms';
import { overviewLookOf } from './overview-look';
import { overviewSurfaceOf, overviewTextScale, withOverviewChange } from './overview-style';

// docs/specs/026-plan/plan-overview.md "Style".
const firstTab = {
  id: 't1',
  name: 'Board',
  elements: [],
  theme: 'brand',
  backgroundPattern: 'lines',
  font: FONTS[0]!.id,
  defaultTextSize: 'lg',
} as unknown as Tab;

describe('what the Overview wears', () => {
  it('wears its first tab’s style while it has none of its own', () => {
    expect(overviewLookOf(null, firstTab)).toEqual({
      theme: 'brand',
      backgroundPattern: 'lines',
      font: FONTS[0]!.id,
      defaultTextSize: 'lg',
    });
    expect(overviewLookOf(null, undefined)).toEqual({});
  });

  it('wears its own once it has one', () => {
    expect(overviewLookOf({ theme: 'brand' }, firstTab)).toEqual({ theme: 'brand' });
  });
});

describe('a Style pick on the Overview', () => {
  it('runs the tab’s own transforms, starting from what it wears', () => {
    const look = overviewLookOf(null, firstTab);
    const sized = withOverviewChange(look, (t) => withTabTextSize(t, 'sm'));
    expect(sized).toMatchObject({ backgroundPattern: 'lines', defaultTextSize: 'sm' });
  });

  it('lands a theme as picking it on a tab does (its backdrop too)', () => {
    const other = TAB_LOOKS.find((l) => l.theme !== 'brand')!.theme;
    const onTab = withThemeApplied({ ...firstTab }, other);
    const themed = withOverviewChange(overviewLookOf(null, firstTab), (t) =>
      withThemeApplied(t, other),
    );
    expect(themed.theme).toBe(other);
    expect(themed.backgroundColor).toBe(onTab.backgroundColor);
  });

  it('lands a look, and keeps nothing a page does not wear (Finish)', () => {
    const look = TAB_LOOKS[1]!;
    const next = withOverviewChange({}, (t) => withLookApplied(t, look));
    expect(next.theme).toBe(look.theme);
    expect(next.backgroundPattern).toBe(look.pattern);
    expect(next).not.toHaveProperty('finish');
  });
});

describe('the page the style draws', () => {
  it('reads as dark on a dark backdrop and light on a light one, whatever the viewer’s chrome', () => {
    expect(overviewSurfaceOf({ backgroundColor: '#0f172a' }, 'light').scheme).toBe('dark');
    expect(overviewSurfaceOf({ backgroundColor: '#fefce8' }, 'dark').scheme).toBe('light');
  });

  it('keeps the viewer’s scheme under a faint backdrop', () => {
    const faint = { backgroundColor: '#0f172a', backgroundOpacity: 0.2 };
    expect(overviewSurfaceOf(faint, 'light').scheme).toBe('light');
  });

  it('paints an opaque backdrop, its font and its type scale', () => {
    const { style } = overviewSurfaceOf(
      { backgroundColor: '#fefce8', font: FONTS[0]!.id, defaultTextSize: 'lg' },
      'light',
    );
    expect(String(style.backgroundColor)).toContain('color-mix(in srgb, #fefce8 100%');
    expect(style.fontFamily).toBeTruthy();
    expect((style as Record<string, string>)['--text-sm']).toBe(`${0.875 * 1.125}rem`);
  });

  it('leaves the type alone at Medium', () => {
    const { style } = overviewSurfaceOf({}, 'light');
    expect(style).not.toHaveProperty('--text-sm');
    expect(style).not.toHaveProperty('fontFamily');
  });

  it('reads an exact size as the nearest of Small, Medium and Large', () => {
    expect(overviewTextScale(10)).toBe(0.9);
    expect(overviewTextScale(14)).toBe(1);
    expect(overviewTextScale(24)).toBe(1.125);
    expect(overviewTextScale('scale')).toBe(1);
    expect(overviewTextScale(undefined)).toBe(1);
  });
});
