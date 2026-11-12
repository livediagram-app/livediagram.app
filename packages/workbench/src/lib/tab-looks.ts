// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set four of a tab's existing
// settings at once, its theme, finish, tab font and canvas pattern. The lookup, the apply and the match, one copy
// for every editor. Each editor's lib/tab-looks.ts keeps its own catalogue (TAB_LOOKS, its look ids and patterns)
// and binds these once over it, the seasonal looks and its theme apply.
import { resolveFinish, type Finish } from '@liveworkspace/element-model/finish';

/** How many looks one carousel page holds. */
export const LOOKS_PER_PAGE = 6;

/** What every look holds (each editor's `TabLook`, whose ids and patterns are its own unions). */
export type TabLookFields = {
  id: string;
  theme: string;
  finish: Finish;
  font: string | undefined;
  pattern: string;
  patternOpacity?: number;
};

/** The four settings a look sets, as a tab holds them. */
export type TabLookSettings = {
  theme?: string;
  finish?: unknown;
  font?: string;
  backgroundPattern?: string;
  backgroundOpacity?: number;
};

export type TabLooksDeps<Tab extends TabLookSettings, Look extends TabLookFields> = {
  // Every named look, year-round and seasonal: a tab wearing a seasonal look reads as that look too.
  looks: readonly Look[];
  // The editor's theme apply (its lib/tab-theme-apply withThemeApplied), exactly as picking the theme does.
  withThemeApplied: (tab: Tab, themeId: string) => Tab;
  // Whether the tab's pattern is the look's. By default an unset pattern reads as the grid it draws; livehuddle
  // compares the floors the two draw as (a retired diagram pattern reads as the floor it draws as).
  samePattern?: (lookPattern: Look['pattern'], tabPattern: Tab['backgroundPattern']) => boolean;
};

const sameOrGrid = (lookPattern: string, tabPattern: string | undefined) =>
  lookPattern === (tabPattern ?? 'grid');

export function createTabLooks<Tab extends TabLookSettings, Look extends TabLookFields>({
  looks: ALL_LOOKS,
  withThemeApplied,
  samePattern = sameOrGrid,
}: TabLooksDeps<Tab, Look>) {
  function tabLookById(id: string): Look | undefined {
    return ALL_LOOKS.find((l) => l.id === id);
  }

  /** The tab with a look applied: the theme exactly as picking it does, then the finish, font and pattern. */
  function withLookApplied(tab: Tab, look: Look): Tab {
    const themed = withThemeApplied(tab, look.theme);
    const next: TabLookSettings = {
      ...themed,
      finish: look.finish,
      backgroundPattern: look.pattern,
    };
    // A look that sets a strength sets it; the rest leave the tab's own strength alone.
    if (look.patternOpacity !== undefined) next.backgroundOpacity = look.patternOpacity;
    if (look.font) next.font = look.font;
    else delete next.font;
    return next as Tab;
  }

  /** Whether the tab's settings are the look's. Unset settings read as what they draw: the Default theme, Flexible,
   *  no font, the grid (or, as the editor's samePattern says, the floor it draws). A pattern's strength counts only for a look that sets one (a template's softened grid is
   *  still Everyday). */
  function lookMatches(tab: TabLookSettings, look: Look): boolean {
    const opacity = tab.backgroundOpacity ?? 1;
    return (
      look.theme === (tab.theme ?? 'brand') &&
      look.finish === resolveFinish(tab.finish, undefined) &&
      look.font === (tab.font || undefined) &&
      samePattern(look.pattern, tab.backgroundPattern) &&
      (look.patternOpacity === undefined || Math.abs(look.patternOpacity - opacity) < 0.001)
    );
  }

  /** The look the tab's settings match, or undefined when it has its own mix. */
  function activeLookId(tab: TabLookSettings): Look['id'] | undefined {
    return ALL_LOOKS.find((l) => lookMatches(tab, l))?.id;
  }

  return { tabLookById, withLookApplied, lookMatches, activeLookId };
}
