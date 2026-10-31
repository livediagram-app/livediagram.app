import { describe, expect, it } from 'vitest';
import { contrastRatio, mixHex, planPalette, type PlanPalette } from '@liveplanner/project';
import { startBadgeInk } from './StartCard';

// docs/specs/007-editor/start-panel.md "Look": a start card's badge ("Board", "Sheet" where kinds mix) is small
// text, so its ink reads at AA on the badge as drawn (the accent's 14% tint over the card). The violet accent on its
// own read 4.43:1 there.
describe('a start card badge', () => {
  const palettes: [string, Pick<PlanPalette, 'surface' | 'focus'>][] = [
    ['violet on white', { surface: '#ffffff', focus: '#7c3aed' }],
    ['pink on white', { surface: '#ffffff', focus: '#db2777' }],
    ['sky on white', { surface: '#ffffff', focus: '#0ea5e9' }],
    ['light', planPalette('light', {})],
    ['dark', planPalette('dark', {})],
  ];
  it.each(palettes)('reads at AA: %s', (_, palette) => {
    // color-mix(in srgb, focus 14%, surface), as the badge draws.
    const fill = mixHex(palette.focus, palette.surface, 0.14);
    const ink = startBadgeInk(palette as PlanPalette);
    expect(contrastRatio(ink, fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the accent where it already reads', () => {
    const palette = { surface: '#ffffff', focus: '#4c1d95' } as PlanPalette;
    expect(startBadgeInk(palette)).toBe('#4c1d95');
  });
});
