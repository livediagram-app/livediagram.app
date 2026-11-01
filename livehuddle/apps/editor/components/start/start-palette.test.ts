import { describe, expect, it } from 'vitest';
import { contrastRatio, mixHex } from '@livehuddle/document';
import {
  CHOSEN_HOVER_TINT,
  CHOSEN_TINT,
  chosenLabel,
  startPalette,
  startPanelColours,
  type StartPalette,
} from './start-palette';

// docs/specs/007-editor/start-diagramming.md "Rail": the chosen row's label reads at AA on its tint and its hover's.
describe('chosenLabel', () => {
  const on = (p: StartPalette, pct: number) => mixHex(p.focus, p.surface, pct / 100);
  const cases: [string, StartPalette][] = [
    ['light', startPalette('light')],
    ['dark', startPalette('dark')],
    [
      'a pale themed accent',
      startPalette('light', { fill: '#fdf2f8', stroke: '#f472b6', text: '#831843' }),
    ],
  ];

  it.each(cases)('reaches 4.5:1 on the chosen row in %s', (_, p) => {
    const ink = chosenLabel(p);
    for (const pct of [CHOSEN_TINT, CHOSEN_HOVER_TINT])
      expect(contrastRatio(ink, on(p, pct))).toBeGreaterThanOrEqual(4.5);
  });

  it('darkens the light accent, which read about 3.4:1 on its own tint', () => {
    const p = startPalette('light');
    expect(contrastRatio(p.focus, on(p, CHOSEN_TINT))).toBeLessThan(4.5);
    expect(chosenLabel(p)).not.toBe(p.focus);
  });
});

// docs/specs/007-editor/start-diagramming.md "Look"
describe('startPanelColours', () => {
  const theme = {
    backgroundColor: '#fdf2f8',
    elementStroke: '#db2777',
    elementText: '#831843',
  };

  it("wears the tab's canvas, the theme's stroke as its accent and the theme's text as its ink", () => {
    expect(startPanelColours({}, theme)).toEqual({
      fill: '#fdf2f8',
      stroke: '#db2777',
      text: '#831843',
    });
  });

  it("prefers the tab's own canvas colour over the theme's", () => {
    expect(startPanelColours({ backgroundColor: '#ecfeff' }, theme).fill).toBe('#ecfeff');
  });

  it("reads a multi-colour theme's trunk colour as its accent", () => {
    const rainbow = {
      backgroundColor: '#ffffff',
      elementStroke: null,
      elementText: null,
      rootColor: { fill: '#fff', stroke: '#7c3aed', text: '#2e1065' },
    };
    expect(startPanelColours({}, rainbow)).toMatchObject({ stroke: '#7c3aed', text: '#2e1065' });
  });

  it('leaves an unthemed tab the app’s own look', () => {
    expect(
      startPanelColours({}, { backgroundColor: '#fff', elementStroke: null, elementText: null }),
    ).toEqual({});
  });
});
