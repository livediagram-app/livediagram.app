import { describe, expect, it } from 'vitest';
import { contrastRatio, planPalette, type PlanPalette } from '@liveplanner/project';
import { communityStartBadgeStyle } from '@liveworkspace/community-ui/start';

// docs/specs/007-editor/start-panel.md "Look": a start card's badge ("Board", "Sheet" where kinds mix, Community) is
// small text, so its ink reads at AA on the badge as drawn (the accent's 14% tint over the card), with the shared
// badge colours (@liveworkspace/community-ui/start). The violet accent on its own read 4.43:1 there.
describe('a start card badge', () => {
  const palettes: [string, Pick<PlanPalette, 'surface' | 'focus'>][] = [
    ['violet on white', { surface: '#ffffff', focus: '#7c3aed' }],
    ['pink on white', { surface: '#ffffff', focus: '#db2777' }],
    ['sky on white', { surface: '#ffffff', focus: '#0ea5e9' }],
    ['light', planPalette('light', {})],
    ['dark', planPalette('dark', {})],
  ];
  it.each(palettes)('reads at AA: %s', (_, palette) => {
    const { backgroundColor, color } = communityStartBadgeStyle(palette.focus, palette.surface);
    expect(contrastRatio(color, backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the accent where it already reads', () => {
    expect(communityStartBadgeStyle('#4c1d95', '#ffffff').color).toBe('#4c1d95');
  });
});
