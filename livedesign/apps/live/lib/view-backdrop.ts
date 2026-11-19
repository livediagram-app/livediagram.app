// The backdrop a viewer's canvas paints (docs/specs/011-theme/light-and-dark.md): the tab's own colour (its theme's
// canvas, or the custom colour) and its pattern, the theme's own included, around the pages. It used to paint blank
// while the tab kept its theme's pattern, which hid every look whose pattern was its theme's; a look or a pattern
// picked in Tab Style now always shows, as in liveplanner. Exports and thumbnails use the tab's backdrop too
// (resolveTabBackdrop).
import type { Appearance, Tab } from '@livedesign/design';
import { getResolvedAppearance } from '@livedesign/ui';
import { resolveTabBackdrop, type ResolvedBackdrop } from './themes';

export function resolveViewBackdrop(
  tab: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  appearance: Appearance = getResolvedAppearance(),
): ResolvedBackdrop {
  return resolveTabBackdrop(tab, appearance);
}
