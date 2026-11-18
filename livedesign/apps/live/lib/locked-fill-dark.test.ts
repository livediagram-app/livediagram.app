import { describe, expect, it } from 'vitest';
import { buildTemplate, templateCanvasOverrides } from '@livedesign/templates';
import { THEMES, layOutPages, pagesOf, type Appearance, type Tab } from '@livedesign/design';
import { themeViewMap } from './themes';
import { withThemeApplied } from './tab-theme-apply';
import { createStockColourProjector, pageViewOf, plainPaper } from './stock-colour-projector';

// docs/specs/011-theme/light-and-dark.md "Ink marks on the plain paper stay seen" (Work Tracker 1186): a fill marked
// to stay fixed (themeLockFill) is drawn at its exact value in the light and the dark editor, under every theme, so
// the Brand Board's swatches match the hex codes printed under them.

const KIND = 'logo-brand-board';
const APPEARANCES: Appearance[] = ['light', 'dark'];

/** The Brand Board as the canvas draws it in `appearance`, with `theme` picked (none: as stored). */
function drawnBoard(appearance: Appearance, theme?: string) {
  const opened: Tab = {
    id: 't',
    name: 't',
    elements: buildTemplate(KIND, 0, 0),
    ...templateCanvasOverrides(KIND),
  };
  const tab = theme ? withThemeApplied(opened, theme, appearance) : opened;
  const pageView = pageViewOf(tab.elements, layOutPages(pagesOf(tab)), {
    light: themeViewMap(tab.theme, 'light'),
    dark: themeViewMap(tab.theme, 'dark'),
  });
  const drawn = createStockColourProjector()(
    tab.elements,
    appearance,
    themeViewMap(tab.theme, appearance),
    plainPaper(appearance),
    pageView,
  );
  return { stored: tab.elements, drawn };
}

type Fill = { id: string; fillColor?: string; themeLockFill?: boolean };

describe('a locked fill on the canvas', () => {
  for (const appearance of APPEARANCES) {
    it(`draws every Brand Board swatch at its stored hex in the ${appearance} editor`, () => {
      const { stored, drawn } = drawnBoard(appearance);
      const locked = (stored as Fill[]).filter((el) => el.themeLockFill && el.fillColor);
      // Teal, Coral, Sand and Ink, the mark's discs and the app icons.
      expect(locked.length).toBeGreaterThan(8);
      for (const el of locked) {
        expect((drawn as Fill[]).find((d) => d.id === el.id)?.fillColor).toBe(el.fillColor);
      }
      for (const hex of ['#0f4c5c', '#14213d']) {
        expect((drawn as Fill[]).some((d) => d.fillColor === hex)).toBe(true);
      }
    });
  }

  it('keeps every locked fill under every theme, in either half', () => {
    for (const appearance of APPEARANCES)
      for (const theme of THEMES) {
        const { stored, drawn } = drawnBoard(appearance, theme.id);
        for (const el of stored as Fill[]) {
          if (!el.themeLockFill || !el.fillColor) continue;
          expect((drawn as Fill[]).find((d) => d.id === el.id)?.fillColor, theme.id).toBe(
            el.fillColor,
          );
        }
      }
  });
});
