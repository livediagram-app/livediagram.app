// The backdrop a viewer's canvas paints (docs/specs/026-plan/plan-mode.md "The canvas"): the tab's own colour and
// pattern (its theme's, or the ones picked), resolved for the viewer's appearance. Exports and thumbnails use the
// same (resolveTabBackdrop).
import type { Appearance, Tab } from '@liveplanner/project';
import { getResolvedAppearance } from '@liveplanner/ui';
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
