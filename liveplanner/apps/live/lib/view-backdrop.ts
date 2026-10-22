// The backdrop a viewer's canvas paints (docs/specs/026-plan/plan-mode.md "The canvas"): the tab's own colour (its
// theme's canvas, or the custom colour), on a blank canvas while the tab's pattern is still its theme's, since boards,
// sheets and dashboards carry the page; a pattern someone picked always shows. Exports and thumbnails use the tab's
// backdrop (resolveTabBackdrop).
import type { Appearance, Tab } from '@liveplanner/document';
import { getResolvedAppearance } from '@liveplanner/ui';
import { getTheme, resolveTabBackdrop, type ResolvedBackdrop } from './themes';

export function resolveViewBackdrop(
  tab: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  appearance: Appearance = getResolvedAppearance(),
): ResolvedBackdrop {
  const backdrop = resolveTabBackdrop(tab, appearance);
  const themes = getTheme(tab.theme, appearance).backgroundPattern;
  const untouched = tab.backgroundPattern === undefined || tab.backgroundPattern === themes;
  return untouched ? { ...backdrop, backgroundPattern: 'blank' } : backdrop;
}
