// What a tab added from the tab bar starts with: the theme, canvas
// styling and type of the tab it was added from, so a user mid-diagram who hits "+ tab" keeps
// their visual context. Each tab keeps its own styling once created. Never an editor mode: the mode
// is newTabOpening's, until a template chosen for it says otherwise (docs/specs/007-editor/editor-modes.md
// "Where the mode lives").
import type { EditorMode, Tab } from '@livehuddle/document';

export function newTabSeed(source: Tab | undefined): Partial<Tab> {
  if (!source) return {};
  return {
    theme: source.theme,
    backgroundPattern: source.backgroundPattern,
    backgroundColor: source.backgroundColor,
    backgroundOpacity: source.backgroundOpacity,
    patternColor: source.patternColor,
    font: source.font,
    // Small (docs/specs/004-interface-design/fonts.md) when the source has no explicit size.
    defaultTextSize: source.defaultTextSize ?? 'sm',
  };
}

// How a new tab opens for its maker (docs/specs/007-editor/editor-modes.md): in `mode` when asked, otherwise in
// `creatorMode`, the mode of the tab its maker was on. Workshop is the one mode, written so the tab says so.
export function newTabOpening(
  creatorMode: EditorMode,
  mode?: EditorMode,
): { opensIn?: EditorMode } {
  const opensIn = mode ?? creatorMode;
  return { opensIn };
}
