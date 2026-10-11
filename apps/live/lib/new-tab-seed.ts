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
// Diagram"). Asked for in a `mode` (a Plan tab offering a new tab in another mode, plan-tabs.md), it opens in that
// mode; otherwise from Plan it opens in Plan, for everyone, and from any other mode in Diagram. Every mode's empty tab
// starts on its own chooser (Start Diagramming, Start Drawing, Start Facilitating, Start Illustrating, Start
// Planning: start-diagramming.md), so none opens the Quick Start over it.
export function newTabOpening(
  creatorMode: EditorMode,
  mode?: EditorMode,
): { opensIn?: EditorMode; quickStart: false } {
  const opensIn = mode ?? (creatorMode === 'plan' ? 'plan' : undefined);
  return opensIn && opensIn !== 'diagram' ? { opensIn, quickStart: false } : { quickStart: false };
}
