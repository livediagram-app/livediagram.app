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
            for (const stored of tab.elements as Painted[]) {
              if (typeof stored.fillColor !== 'string' || typeof stored.textColor !== 'string')
                continue;
              const drawn = viewElementInTheme(stored, map) as Painted;
              const before = contrastRatio(stored.textColor, stored.fillColor);
              const after = contrastRatio(drawn.textColor as string, drawn.fillColor as string);
              if (after < Math.min(THEME_TEXT_CONTRAST, before) - 0.01)
                problems.push(
                  `${theme.id} picked ${picker}, seen ${viewer}: ${stored.label ?? stored.id} ` +
                    `${drawn.textColor} on ${drawn.fillColor} (${after.toFixed(2)}, stored ${before.toFixed(2)})`,
                );
            }
          }
        }
      expect(problems).toEqual([]);
    });
  }
});
