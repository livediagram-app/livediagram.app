// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", docs/specs/011-theme/
// multicolour-themes.md): the tab's theme id, its backdrop and its elements' colours, as one pure transform. Picking a
// theme (useTabTheme.setTheme) and picking a look (useTabCanvas.applyTabLook) both run it, so a look's theme lands
// exactly as picking that theme does.
import { keepUnchangedElements } from '@liveworkspace/workbench/lib/keep-unchanged-elements';
import { withTabStyleOf } from '@liveworkspace/workbench/lib/tab-style-to-all';
import {
  newPageBackgroundOf,
  pagesGivenNewPageBackground,
  pagesOf,
  tabWithTheme,
  withEveryPageOnTabDesign,
  type Appearance,
  type Tab,
} from '@livedocuments/document';
import { getResolvedAppearance } from '@livedocuments/ui';

// The tab restyled from scratch, in the viewer's appearance: the shared transform (@livedocuments/document
// tab-theme-apply), which the MCP's tab_style runs too.
function themeAppliedAnew(
  source: Tab,
  id: string,
  appearance: Appearance = getResolvedAppearance(),
): Tab {
  return tabWithTheme(source, id, appearance);
}

/** The tab with theme `id` applied: preserve-customs for shapes, text and backdrop; arrows always re-tinted.
 *  An element the pick leaves as it was is handed back as the same object, so its view does not render again
 *  (keepUnchangedElements; docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board keeps the page
 *  answering"). */
export function withThemeApplied(source: Tab, id: string, appearance?: Appearance): Tab {
  const tab = themeAppliedAnew(source, id, appearance);
  return { ...tab, elements: keepUnchangedElements(source.elements, tab.elements) };
}

/** `target` restyled from `source` for Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md): `source`'s
 *  theme applied as picking it does, then its canvas, text defaults and finish exactly (withTabStyleOf). */
export function withStyleOfTab(target: Tab, source: Tab): Tab {
  const styled = withTabStyleOf(withThemeApplied(target, source.theme ?? 'brand'), source);
  // Copy to All Tabs dresses the pages too (owner, 2026-11-25): each unlocked page takes the source's background
  // and drops a design of its own for the tab's, as All Pages does within a tab.
  if (!pagesOf(styled).length) return styled;
  const backed = newPageBackgroundOf(source) ? pagesGivenNewPageBackground(styled).tab : styled;
  return withEveryPageOnTabDesign(backed);
}
