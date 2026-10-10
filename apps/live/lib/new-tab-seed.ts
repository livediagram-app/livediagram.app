// What a tab added from the tab bar (or Quick Start's new tab) starts with: the theme, canvas
// styling and type of the tab it was added from, so a user mid-diagram who hits "+ tab" keeps
// their visual context. Each tab keeps its own styling once created. Never an editor mode: a new
// tab opens in Diagram whatever mode its creator is in (Plan aside, newTabOpening), until a template
// chosen for it says otherwise (docs/specs/007-editor/editor-modes.md "Where the mode lives").
import type { EditorMode, Tab } from '@livediagram/document';

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

// How a new tab opens for its maker (docs/specs/007-editor/editor-modes.md "New documents and new tabs open in
// Diagram"): from Plan it opens in Plan, for everyone, with no Quick Start (Plan's own board picker is its
// start); from any other mode it opens as ever, in Diagram with the Quick Start.
export function newTabOpening(
  creatorMode: EditorMode,
): { opensIn: 'plan'; quickStart: false } | { quickStart: true } {
  return creatorMode === 'plan' ? { opensIn: 'plan', quickStart: false } : { quickStart: true };
}
