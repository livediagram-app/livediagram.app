// What a tab added from the tab bar (or Quick Start's new tab) starts with
// (docs/specs/007-editor/editor-modes.md "Where the mode lives"): the theme, canvas styling and
// type of the tab it was added from, so a user mid-diagram who hits "+ tab" keeps their visual
// context, and the creator's current editor mode as its opening mode, so a tab made in Draw mode
// opens in Draw. Each tab keeps its own styling once created; a template or import that sets its
// own opening mode wins later.
import { DEFAULT_EDITOR_MODE, type EditorMode, type Tab } from '@livediagram/document';

export function newTabSeed(source: Tab | undefined, creatorMode: EditorMode): Partial<Tab> {
  const opensIn = creatorMode === DEFAULT_EDITOR_MODE ? {} : { opensIn: creatorMode };
  if (!source) return opensIn;
  return {
    theme: source.theme,
    backgroundPattern: source.backgroundPattern,
    backgroundColor: source.backgroundColor,
    backgroundOpacity: source.backgroundOpacity,
    patternColor: source.patternColor,
    font: source.font,
    // Small (docs/specs/004-interface-design/fonts.md) when the source has no explicit size.
    defaultTextSize: source.defaultTextSize ?? 'sm',
    ...opensIn,
  };
}
