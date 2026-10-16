import { describe, expect, it } from 'vitest';
import {
  dashboardCardLook,
  readDashboardCardStyle,
  setDashboardCardStyle,
} from './dashboard-card-style';
import { readDashboard, moveDashboardSlot, remapDashboardElements } from './dashboard';
import { contrastRatio } from './colors';
import { shapeColorPresets } from './theme-presets';
import { THEMES, defaultScheme } from './themes';

// docs/specs/026-plan/plan-tabs.md "Card style".
const layout = (content: unknown, more: unknown[] = []) =>
  readDashboard({
    rows: [{ id: 'r', height: 320, slots: [{ id: 's', span: 6, content }, ...more] }],
  })!;
const contentOf = (l: ReturnType<typeof layout>, id = 's') =>
  l.rows.flatMap((r) => r.slots).find((s) => s.id === id)?.content as
    { style?: unknown } | undefined;

describe('reading a card style', () => {
  it('keeps what it knows and drops the rest', () => {
    expect(
      readDashboardCardStyle(
        {
          preset: 'soft',
          fill: '#FFEEDD',
          stroke: 'red',
          text: 'transparent',
          borderWidth: 'thick',
          borderStyle: 'zigzag',
          shadow: { offsetX: 99, offsetY: 2, blur: 4, opacity: 2 },
          evil: '<script>',
        },
        'note',
      ),
    ).toEqual({
      preset: 'soft',
      fill: '#FFEEDD',
      text: 'transparent',
      borderWidth: 'thick',
      shadow: { offsetX: 24, offsetY: 2, blur: 4, opacity: 1 },
    });
  });

  it('refuses a preset id that is not one, and is nothing when nothing is left', () => {
    expect(readDashboardCardStyle({ preset: 'Soft Look!' }, 'status')).toBeUndefined();
    expect(readDashboardCardStyle('soft', 'status')).toBeUndefined();
    expect(readDashboardCardStyle({ shadow: 'none' }, 'links')).toEqual({ shadow: 'none' });
  });

  it('keeps only the text colour on a Title', () => {
    expect(
      readDashboardCardStyle({ preset: 'bold', fill: '#000000', text: '#123456' }, 'title'),
    ).toEqual({ text: '#123456' });
  });
});

describe('a styled card in a layout', () => {
  it('round-trips through reading a stored layout (a JSON export and import)', () => {
    const l = layout({ type: 'note', title: 'A', text: '', style: { preset: 'info', bogus: 1 } });
    expect(contentOf(l)?.style).toEqual({ preset: 'info' });
    const again = readDashboard(JSON.parse(JSON.stringify(l)))!;
    expect(again).toEqual(l);
  });

  it('is never kept on a slot that is not a Utility', () => {
    const l = layout({ type: 'element', elementId: 'e', style: { preset: 'info' } });
    expect(contentOf(l)?.style).toBeUndefined();
  });

  it('is set, changed and cleared, the same layout when nothing changes', () => {
    const l = layout({ type: 'checklist', title: 'C', items: [] });
    const styled = setDashboardCardStyle(l, 's', { preset: 'solid' });
    expect(contentOf(styled)?.style).toEqual({ preset: 'solid' });
    expect(setDashboardCardStyle(styled, 's', { preset: 'solid' })).toBe(styled);
    const cleared = setDashboardCardStyle(styled, 's', undefined);
    expect(contentOf(cleared)).toEqual({ type: 'checklist', title: 'C', items: [] });
    expect(setDashboardCardStyle(l, 'missing', { preset: 'solid' })).toBe(l);
  });

  it('travels with its card when slots swap, and through a re-minted copy', () => {
    const l = layout({ type: 'note', title: 'A', text: '', style: { fill: '#000000' } }, [
      { id: 't', span: 6, content: { type: 'note', title: 'B', text: '' } },
    ]);
    const swapped = moveDashboardSlot(l, 's', { kind: 'slot', slotId: 't' }, () => 'x');
    expect(contentOf(swapped, 't')?.style).toEqual({ fill: '#000000' });
    expect(contentOf(swapped, 's')?.style).toBeUndefined();
    expect(contentOf(remapDashboardElements(l, new Map()))?.style).toEqual({ fill: '#000000' });
  });
});

describe('the look a style draws', () => {
  const theme = defaultScheme('light');

  it('is the Dashboard’s own with no style', () => {
    expect(dashboardCardLook(undefined, theme)).toEqual({});
  });

  it('resolves a preset against the theme, as a shape’s', () => {
    for (const t of [theme, ...THEMES.slice(0, 6)]) {
      const p = shapeColorPresets(t).find((x) => x.id === 'tinted')!;
      const look = dashboardCardLook({ preset: 'tinted' }, t);
      expect(look).toMatchObject({ fill: p.fill, stroke: p.stroke, ink: p.text });
    }
  });

  it('reads on a fill set by hand, its quieter lines too', () => {
    for (const fill of ['#0f172a', '#ffffff', '#facc15', '#7c3aed']) {
      const look = dashboardCardLook({ preset: 'soft', fill }, theme);
      expect(contrastRatio(look.ink!, fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(look.inkSoft!, fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps a text colour set by hand, and draws dash-dot dashed', () => {
    const look = dashboardCardLook(
      { text: '#ff0000', borderWidth: 'thick', borderStyle: 'dash-dot', shadow: 'none' },
      theme,
    );
    expect(look).toEqual({
      ink: '#ff0000',
      inkSoft: '#ff0000',
      borderWidth: 4,
      borderStyle: 'dashed',
      shadow: 'none',
    });
  });
});
