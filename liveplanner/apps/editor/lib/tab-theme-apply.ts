// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", docs/specs/011-theme/
// multicolour-themes.md): the tab's theme id, its backdrop and its elements' colours, as one pure transform. Picking a
// theme (useTabTheme.setTheme) and picking a look (useTabCanvas.applyTabLook) both run it, so a look's theme lands
// exactly as picking that theme does, and as an agent's style_project lands it.
import { keepUnchangedElements } from '@liveworkspace/workbench/lib/keep-unchanged-elements';
import { withTabStyleOf } from '@liveworkspace/workbench/lib/tab-style-to-all';
import { tabWithTheme, type Appearance, type Tab } from '@liveplanner/project';
import { getResolvedAppearance } from '@liveplanner/ui';

// The tab restyled from scratch, in the viewer's appearance: the shared transform (@liveplanner/project
// tab-theme-apply), which the api's style changeset runs too.
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
  return withTabStyleOf(withThemeApplied(target, source.theme ?? 'brand'), source);
}
