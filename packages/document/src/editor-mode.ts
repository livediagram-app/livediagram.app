// Editor modes (docs/specs/007-editor/editor-modes.md): how a general tab is worked on, Diagram or
// Draw. A mode tunes tools and rules; it never decides what the tab is (that is its kind). The
// mode a person works in is theirs (the editor remembers it per tab, device-locally); the tab only
// says which mode it OPENS in (`Tab.opensIn`, Diagram when absent).
import type { Layer } from './layers';
import { isEventStormingTab } from './event-storming';

export type EditorMode = 'diagram' | 'draw';

export const EDITOR_MODES: readonly EditorMode[] = ['diagram', 'draw'];

export const DEFAULT_EDITOR_MODE: EditorMode = 'diagram';

export function isEditorMode(v: unknown): v is EditorMode {
  return v === 'diagram' || v === 'draw';
}

type ModeTab = { kind?: string; opensIn?: string; layers?: Layer[] };

// An event-storming board keeps its own tools and notation, so it is worked on in Diagram mode and
// offers no switch, whatever a forged or stale `opensIn` says.
export function editorModeSwitchable(tab: ModeTab | undefined): boolean {
  return !isEventStormingTab(tab);
}

/** The mode a person who has not switched on this tab sees it in. */
export function opensInOf(tab: ModeTab | undefined): EditorMode {
  if (!editorModeSwitchable(tab)) return DEFAULT_EDITOR_MODE;
  return isEditorMode(tab?.opensIn) ? tab.opensIn : DEFAULT_EDITOR_MODE;
}

// The one gate every LOOK decision (the board backdrop, the ink projection, the theme being set
// aside) reads, keyed on the viewer's effective editor mode.
export function hasBoardLook(mode: EditorMode): boolean {
  return mode === 'draw';
}
