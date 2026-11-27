// Applying a theme to one tab (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel", docs/specs/011-theme/
// multicolour-themes.md): the tab's theme id, its backdrop and its elements' colours, as one pure transform. Picking a
// theme (useTabTheme.setTheme) and picking a look (useTabCanvas.applyTabLook) both run it, so a look's theme lands
// exactly as picking that theme does.
import { keepUnchangedElements } from '@liveworkspace/workbench/lib/keep-unchanged-elements';
import { withTabStyleOf } from '@liveworkspace/workbench/lib/tab-style-to-all';
import {
  tabWithTheme,
  type Appearance,
  type Tab,
  type ThemeApplyOptions,
} from '@livedesign/design';
import { getResolvedAppearance } from '@livedesign/ui';

export type { ThemeApplyOptions } from '@livedesign/design';

// The tab restyled from scratch, in the viewer's appearance: the shared transform (@livedesign/design
// tab-theme-apply), which the agents' tab_style runs too.
function themeAppliedAnew(
  source: Tab,
  id: string,
  appearance: Appearance = getResolvedAppearance(),
  options: ThemeApplyOptions = {},
): Tab {
  return tabWithTheme(source, id, appearance, options);
}

/** The tab with theme `id` applied: preserve-customs for shapes, arrows, text and backdrop, or no element recoloured
 *  with `keepElementColours`.
 *  An element the pick leaves as it was is handed back as the same object, so its view does not render again
 *  (keepUnchangedElements; docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board keeps the page
 *  answering"). */
export function withThemeApplied(
  source: Tab,
  id: string,
  appearance?: Appearance,
  options?: ThemeApplyOptions,
): Tab {
  const tab = themeAppliedAnew(source, id, appearance, options);
  return { ...tab, elements: keepUnchangedElements(source.elements, tab.elements) };
}

/** `target` restyled from `source` for Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md): `source`'s
 *  theme applied as picking it does under `source`'s Element Colours, then its canvas, text defaults, finish and
 *  Element Colours exactly (withTabStyleOf). */
export function withStyleOfTab(target: Tab, source: Tab): Tab {
  const options = source.keepElementColours ? { keepElementColours: true } : undefined;
  return withTabStyleOf(
    withThemeApplied(target, source.theme ?? 'brand', undefined, options),
    source,
  );
}

/** The options a theme or look pick on `tab` takes when its caller gives none: the tab's own Element Colours. */
export function themeApplyOptionsOf(tab: Tab): ThemeApplyOptions | undefined {
  return tab.keepElementColours ? { keepElementColours: true } : undefined;
}

/** `tab` with Element Colours set: Keep as They Are stored as true, Follow the Theme clearing the key. */
export function withKeepElementColours(tab: Tab, keep: boolean): Tab {
  if (keep) return { ...tab, keepElementColours: true };
  const next = { ...tab };
  delete next.keepElementColours;
  return next;
}
