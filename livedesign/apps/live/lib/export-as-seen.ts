// A tab as the author sees it, for export (docs/specs/011-theme/light-and-dark.md "What a viewer
// sees"): the tab's own backdrop resolved for the export's appearance, whoever exports, and every
// stock colour stored by name in its version for that canvas, so every export format (the image renderers and the text formats alike) draws what the canvas does.
import {
  DEFAULT_BACKGROUND_COLOR,
  canvasSurface,
  elementPageSurfaces,
  layOutPages,
  pagesOf,
  withReadableLabelInks,
  type Appearance,
  type Tab,
} from '@livedesign/document';
import { getResolvedAppearance } from '@livedesign/ui';
import { resolveTabBackdrop, themeViewMap } from './themes';
import { labelsFollowCanvas } from './tab-theme-apply';
import { elementAsSeen, type PageView } from './stock-colour-projector';

export function tabAsSeen(tab: Tab, appearance: Appearance = getResolvedAppearance()): Tab {
  const backdrop = resolveTabBackdrop(tab, appearance);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in the export's half (docs/specs/011-theme/light-and-dark.md), then the stock colours;
  // an element on a page with a fill of its own in the half that page's surface needs, as the canvas draws it.
  const themeMap = themeViewMap(tab.theme, appearance);
  const surfaces = elementPageSurfaces(tab.elements, layOutPages(pagesOf(tab)));
  const pageView: PageView | undefined = surfaces.size
    ? {
        surfaces,
        maps: { light: themeViewMap(tab.theme, 'light'), dark: themeViewMap(tab.theme, 'dark') },
      }
    : undefined;
  const drawn = tab.elements.map((el) => elementAsSeen(el, surface, themeMap, pageView));
  // As the canvas draws them: a label the half sank into what is behind it in an ink that reads there.
  const elements = labelsFollowCanvas(tab)
    ? [
        ...withReadableLabelInks(
          tab.elements,
          tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
          drawn,
          backdrop.backgroundColor,
        ),
      ]
    : drawn;
  return { ...tab, ...backdrop, elements };
}
