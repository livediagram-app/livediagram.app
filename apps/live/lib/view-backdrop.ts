// The backdrop a viewer's canvas paints (docs/specs/007-editor/editor-modes.md "One look"): one
// colour in both editor modes, the tab's own (its theme's canvas, or the custom colour). The
// pattern is the tab's in Diagram mode and the person's own in Draw mode, so choosing it there
// changes nothing for anyone else. Exports and thumbnails use the tab's backdrop (resolveTabBackdrop).
import { hasBoardLook, type Appearance, type EditorMode, type Tab } from '@livediagram/document';
import { getResolvedAppearance } from '@livediagram/ui';
import { resolveTabBackdrop, type ResolvedBackdrop } from './themes';
import type { DrawPattern } from './whiteboard-dock-prefs';

export function resolveViewBackdrop(
  tab: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  view: { mode: EditorMode; drawPattern: DrawPattern },
  appearance: Appearance = getResolvedAppearance(),
): ResolvedBackdrop {
  const backdrop = resolveTabBackdrop(tab, appearance);
  return hasBoardLook(view.mode) ? { ...backdrop, backgroundPattern: view.drawPattern } : backdrop;
}
