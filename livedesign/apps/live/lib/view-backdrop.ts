// The backdrop a viewer's canvas paints (docs/specs/011-theme/light-and-dark.md): the tab's own
// colour (its theme's canvas, or the custom colour). Pages are the paper, so the surround is plain while the
// tab's pattern is still its theme's: a pattern someone picked always shows. Exports and thumbnails use the
// tab's backdrop (resolveTabBackdrop).
import type { Appearance, BackgroundPattern, Tab } from '@livedesign/document';
import { getResolvedAppearance } from '@livedesign/ui';
import { getTheme, resolveTabBackdrop, type ResolvedBackdrop } from './themes';

// The surround's own pattern, shown while the tab's pattern is untouched.
export const PAGES_PATTERN: BackgroundPattern = 'blank';

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
  return untouched ? { ...backdrop, backgroundPattern: PAGES_PATTERN } : backdrop;
}
