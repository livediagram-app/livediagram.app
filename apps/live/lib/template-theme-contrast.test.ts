import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildTemplate } from '@livediagram/templates';
import {
  THEMES,
  THEME_TEXT_CONTRAST,
  contrastRatio,
  viewElementInTheme,
  type Appearance,
  type Element,
  type Tab,
} from '@livediagram/document';
import { withThemeApplied } from './tab-theme-apply';
import { themeViewMap } from './themes';

// docs/specs/011-theme/light-and-dark.md "What a viewer sees": a box's text and fill are drawn as a pair, so drawing
// a tab in a viewer's half never sinks a box's text into its fill. Every template, under every theme picked in either
// appearance, drawn for a light and a dark viewer: wherever the stored text sits on its fill at the floor, the drawn
// text does too, and a stored pair already short of it is never drawn any worse.
type Painted = Element & { fillColor?: unknown; textColor?: unknown; label?: string };

/** The text-on-fill pair an element paints, when it paints both. */
const pairOf = (el: Painted): { text: string; fill: string } | null =>
  typeof el.textColor === 'string' && typeof el.fillColor === 'string'
    ? { text: el.textColor, fill: el.fillColor }
    : null;

const APPEARANCES: Appearance[] = ['light', 'dark'];

describe('templates keep their text readable in both halves of every theme', () => {
  for (const { kind } of TEMPLATES) {
    it(kind, () => {
      const elements = buildTemplate(kind, 0, 0);
      const problems: string[] = [];
      for (const theme of THEMES)
        for (const picker of APPEARANCES) {
          const tab = withThemeApplied({ id: 't', name: 't', elements } as Tab, theme.id, picker);
          for (const viewer of APPEARANCES) {
            const map = themeViewMap(tab.theme, viewer);
            for (const el of tab.elements as Painted[]) {
              const stored = pairOf(el);
              if (!stored) continue;
              const name = `${theme.id} picked ${picker}, seen ${viewer}: ${el.label ?? el.id}`;
              const drawn = pairOf(viewElementInTheme(el, map));
              if (!drawn) {
                problems.push(`${name} drawn without its text or fill`);
                continue;
              }
              const before = contrastRatio(stored.text, stored.fill);
              const after = contrastRatio(drawn.text, drawn.fill);
              if (after < Math.min(THEME_TEXT_CONTRAST, before) - 0.01)
                problems.push(
                  `${name} ${drawn.text} on ${drawn.fill} (${after.toFixed(2)}, stored ${before.toFixed(2)})`,
                );
            }
          }
        }
      expect(problems).toEqual([]);
    });
  }
});
