// A tab as a person in one appearance sees it (docs/specs/011-theme/light-and-dark.md): its backdrop in their half of
// its theme, every theme colour mapped to the same slot in that half, every stock colour stored by name in its version
// for the canvas, and a label that redraw sank into what is behind it in an ink that reads there. Pure: the editor's
// exports (apps/editor/lib/export-as-seen.ts) and the export door's previews (docs/specs/006-document/
// document-snapshots.md "In the viewer's half") draw a tab through it.
import { canvasSurface, type CanvasSurface } from './colors';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import { resolveStockColours } from './stock-colours';
import { themeColourMap, viewBackdropInTheme, viewElementInTheme } from './theme-halves';
import {
  DEFAULT_SCHEME_ID,
  DEFAULT_SCHEME_LIGHT,
  THEMES,
  type Appearance,
  type ThemeDefinition,
} from './themes';
import { withReadableLabelInks } from './label-backdrop';
import type { BackgroundPattern, Element, Tab } from './index';

/** The backdrop a tab paints for one appearance: only its two colours follow the half, the rest is layout. */
export type ResolvedBackdrop = {
  backgroundColor: string;
  patternColor: string;
  backgroundPattern: BackgroundPattern | undefined;
  backgroundOpacity: number | undefined;
};

/** The scheme as written (its native half, before tuning): what its light / dark halves and its colour map are built
 *  from. Undefined for an id that names nothing known. */
export function themeSource(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  if (id === DEFAULT_SCHEME_ID) return DEFAULT_SCHEME_LIGHT;
  return THEMES.find((t) => t.id === id);
}

/** The tab's backdrop in `appearance`: a canvas or pattern colour its scheme painted, in either half, becomes that
 *  half's; a picked colour stays. A scheme nobody knows leaves the backdrop as stored. */
export function tabBackdropInAppearance(
  tab: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  appearance: Appearance,
): ResolvedBackdrop {
  const stored = {
    backgroundColor: tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    patternColor: tab.patternColor ?? DEFAULT_PATTERN_COLOR,
    backgroundPattern: tab.backgroundPattern,
    backgroundOpacity: tab.backgroundOpacity,
  };
  const source = themeSource(tab.theme ?? DEFAULT_SCHEME_ID);
  if (!source) return stored;
  return { ...stored, ...viewBackdropInTheme(stored, source, appearance) };
}

/** One element as drawn on the canvas's surface. */
export function elementAsSeen(
  el: Element,
  surface: CanvasSurface,
  themeMap: ReadonlyMap<string, string>,
): Element {
  return resolveStockColours(viewElementInTheme(el, themeMap), surface);
}

/** The tab as seen in `appearance`. */
export function tabAsSeen(tab: Tab, appearance: Appearance): Tab {
  const backdrop = tabBackdropInAppearance(tab, appearance);
  const surface = canvasSurface(backdrop.backgroundColor);
  // Theme colours in this half, then the stock colours.
  const themeMap = themeColourMap(themeSource(tab.theme) ?? DEFAULT_SCHEME_LIGHT, appearance);
  const drawn = tab.elements.map((el) => elementAsSeen(el, surface, themeMap));
  // As the canvas draws them: a label the half sank into what is behind it in an ink that reads there.
  const elements = [
    ...withReadableLabelInks(
      tab.elements,
      tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      drawn,
      backdrop.backgroundColor,
    ),
  ];
  return { ...tab, ...backdrop, elements };
}
