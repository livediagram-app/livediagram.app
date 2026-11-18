// A tab as the author sees it, for export (docs/specs/011-theme/light-and-dark.md "What a viewer
// sees"): the tab's own backdrop resolved for the export's appearance, whoever exports, and every
// stock colour stored by name in its version for that canvas, so every export format (the image renderers and the text formats alike) draws what the canvas does.
import {
  canvasSurface,
  layOutPages,
  pagesOf,
  type Appearance,
  type Tab,
} from '@livedocuments/document';
import { getResolvedAppearance } from '@livedocuments/ui';
import { resolveTabBackdrop, themeViewMap } from './themes';
import { elementAsSeen, pageViewOf } from './stock-colour-projector';

export function tabAsSeen(tab: Tab, appearance: Appearance = getResolvedAppearance()): Tab {
  const backdrop = resolveTabBackdrop(tab, appearance);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in the export's half (docs/specs/011-theme/light-and-dark.md), then the stock colours;
  // an element on a page with a fill of its own in the half that page's surface needs, as the canvas draws it.
  const themeMap = themeViewMap(tab.theme, appearance);
  const pageView = pageViewOf(tab.elements, layOutPages(pagesOf(tab)), {
    light: themeViewMap(tab.theme, 'light'),
    dark: themeViewMap(tab.theme, 'dark'),
  });
  const elements = tab.elements.map((el) => elementAsSeen(el, surface, themeMap, pageView));
  return { ...tab, ...backdrop, elements };
}
