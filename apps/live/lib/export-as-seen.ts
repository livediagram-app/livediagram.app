// A tab as the author sees it, for export (docs/specs/007-editor/editor-modes.md "One look"): the
// tab's own Diagram backdrop resolved for the export's appearance, whoever exports and in
// whichever editor mode, and every stock colour stored by name in its version for that canvas, so
// every export format (the image renderers and the text formats alike) draws what the canvas does.
import {
  DEFAULT_BACKGROUND_COLOR,
  canvasSurface,
  resolveStockColours,
  viewElementInTheme,
  withReadableLabelInks,
  type Appearance,
  type Tab,
} from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';
import { resolveTabBackdrop, themeViewMap } from './themes';
import { labelsFollowCanvas } from './tab-theme-apply';

export function tabAsSeen(tab: Tab, appearance: Appearance = getResolvedAppearance()): Tab {
  const backdrop = resolveTabBackdrop(tab, appearance);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in the export's half (docs/specs/011-theme/light-and-dark.md), then the stock colours.
  const themeMap = themeViewMap(tab.theme, appearance);
  const drawn = tab.elements.map((el) =>
    resolveStockColours(viewElementInTheme(el, themeMap), surface),
  );
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
