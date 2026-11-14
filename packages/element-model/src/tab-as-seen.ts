// A tab as a person in one appearance sees it (docs/specs/011-theme/light-and-dark.md): its backdrop in their half of
// its theme, every theme colour mapped to the same slot in that half, every stock colour stored by name in its version
// for the canvas, and a label that redraw sank into what is behind it in an ink that reads there. Pure. One copy for
// every product; each binds tabAsSeenFor to its own themes, theme halves, stock colours and label inks at its
// tab-as-seen.ts. The deps come as a function, read once on first use: a product's themes may still be settling in
// its index cycle when its binding is built.
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import { canvasSurface, type CanvasSurface } from './colour-math';
import type { Appearance } from './themes';

/** The backdrop a tab paints for one appearance: only its two colours follow the half, the rest is layout. */
export type ResolvedBackdrop<P = string> = {
  backgroundColor: string;
  patternColor: string;
  backgroundPattern: P | undefined;
  backgroundOpacity: number | undefined;
};

type Colours = { backgroundColor: string; patternColor: string };

/** The backdrop fields of a tab, as stored. */
type StoredBackdrop<P> = {
  theme?: string;
  backgroundColor?: string;
  patternColor?: string;
  backgroundPattern?: P;
  backgroundOpacity?: number;
};

export type TabAsSeenDeps<E, T extends { id: string }> = {
  themes: readonly T[];
  defaultSchemeId: string;
  defaultSchemeLight: T;
  viewBackdropInTheme: (backdrop: Colours, theme: T, appearance: Appearance) => Colours;
  themeColourMap: (theme: T, appearance: Appearance) => ReadonlyMap<string, string>;
  viewElementInTheme: (el: E, map: ReadonlyMap<string, string>) => E;
  resolveStockColours: (el: E, surface: CanvasSurface) => E;
  withReadableLabelInks: (
    stored: E[],
    storedBackground: string,
    drawn: E[],
    background: string,
  ) => Iterable<E>;
};

export function tabAsSeenFor<E, T extends { id: string }, P>(depsOf: () => TabAsSeenDeps<E, T>) {
  let resolved: TabAsSeenDeps<E, T> | undefined;
  const deps = () => (resolved ??= depsOf());

  /** The scheme as written (its native half, before tuning): what its light / dark halves and its colour map are
   *  built from. Undefined for an id that names nothing known. */
  function themeSource(id: string | undefined): T | undefined {
    if (!id) return undefined;
    const { defaultSchemeId, defaultSchemeLight, themes } = deps();
    if (id === defaultSchemeId) return defaultSchemeLight;
    return themes.find((t) => t.id === id);
  }

  /** The tab's backdrop in `appearance`: a canvas or pattern colour its scheme painted, in either half, becomes that
   *  half's; a picked colour stays. A scheme nobody knows leaves the backdrop as stored. */
  function tabBackdropInAppearance(
    tab: StoredBackdrop<P>,
    appearance: Appearance,
  ): ResolvedBackdrop<P> {
    const stored = {
      backgroundColor: tab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      patternColor: tab.patternColor ?? DEFAULT_PATTERN_COLOR,
      backgroundPattern: tab.backgroundPattern,
      backgroundOpacity: tab.backgroundOpacity,
    };
    const source = themeSource(tab.theme ?? deps().defaultSchemeId);
    if (!source) return stored;
    return { ...stored, ...deps().viewBackdropInTheme(stored, source, appearance) };
  }

  /** One element as drawn on the canvas's surface. */
  function elementAsSeen(el: E, surface: CanvasSurface, themeMap: ReadonlyMap<string, string>): E {
    const { resolveStockColours, viewElementInTheme } = deps();
    return resolveStockColours(viewElementInTheme(el, themeMap), surface);
  }

  /** The tab as seen in `appearance`. */
  function tabAsSeen<Tb extends StoredBackdrop<P> & { elements: E[] }>(
    tab: Tb,
    appearance: Appearance,
  ): Tb {
    const backdrop = tabBackdropInAppearance(tab, appearance);
    const surface = canvasSurface(backdrop.backgroundColor);
    // Theme colours in this half, then the stock colours.
    const { themeColourMap, defaultSchemeLight, withReadableLabelInks } = deps();
    const themeMap = themeColourMap(themeSource(tab.theme) ?? defaultSchemeLight, appearance);
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

  return { themeSource, tabBackdropInAppearance, elementAsSeen, tabAsSeen };
}
