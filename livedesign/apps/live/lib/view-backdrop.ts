// The backdrop a viewer's canvas paints (docs/specs/007-editor/editor-modes.md "One look"): one
// colour in every editor mode, the tab's own (its theme's canvas, or the custom colour). The
// pattern is the tab's in Diagram mode and the person's own in Draw mode, so choosing it there
// changes nothing for anyone else. Pages and Plan have a default of their own (MODE_PATTERNS),
// shown only while the tab's pattern is still its theme's: a pattern someone picked always shows.
// Exports and thumbnails use the tab's backdrop (resolveTabBackdrop).
import {
  hasBoardLook,
  type Appearance,
  type BackgroundPattern,
  type EditorMode,
  type Tab,
} from '@livedesign/document';
import { getResolvedAppearance } from '@livedesign/ui';
import { getTheme, resolveTabBackdrop, type ResolvedBackdrop } from './themes';
import type { DrawPattern } from './whiteboard-dock-prefs';

// Each mode's default canvas (editor-modes.md "One look"): Pages mode's pages are the paper, so the
// surround is plain; Plan is a blank canvas, so boards, sheets and dashboards carry the page.
export const MODE_PATTERNS: Partial<Record<EditorMode, BackgroundPattern>> = {
  pages: 'blank',
  plan: 'blank',
};

export function resolveViewBackdrop(
  tab: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  view: { mode: EditorMode; drawPattern: DrawPattern },
  appearance: Appearance = getResolvedAppearance(),
): ResolvedBackdrop {
  const backdrop = resolveTabBackdrop(tab, appearance);
  if (hasBoardLook(view.mode)) return { ...backdrop, backgroundPattern: view.drawPattern };
  const own = MODE_PATTERNS[view.mode];
  if (!own) return backdrop;
  const themes = getTheme(tab.theme, appearance).backgroundPattern;
  const untouched = tab.backgroundPattern === undefined || tab.backgroundPattern === themes;
  return untouched ? { ...backdrop, backgroundPattern: own } : backdrop;
}
