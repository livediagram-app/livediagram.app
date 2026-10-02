// Editor modes (docs/specs/007-editor/editor-modes.md): how a general tab is worked on, Diagram or
// Draw. A mode tunes tools and rules; it never decides what the tab is (that is its kind). The
// mode a person works in is theirs (the editor remembers it per tab, device-locally); the tab only
// says which mode it OPENS in (`Tab.opensIn`, Diagram when absent).
import type { Layer } from './layers';
import { isEventStormingTab } from './event-storming';

// Every editor mode, in the order the interface lists them (the mode switch, the tab menu's Opens
// in). The one place a mode is declared: a further mode is one entry here.
export const EDITOR_MODE_CATALOGUE = [
  { id: 'diagram', label: 'Diagram', description: 'Shapes, arrows, the palette and snapping.' },
  { id: 'draw', label: 'Draw', description: 'Pens, the eraser and shape recognition.' },
] as const satisfies readonly { id: string; label: string; description: string }[];

export type EditorMode = (typeof EDITOR_MODE_CATALOGUE)[number]['id'];

export const EDITOR_MODES: readonly EditorMode[] = EDITOR_MODE_CATALOGUE.map((m) => m.id);

/** "Draw": the mode's name as the interface shows it. */
export function editorModeLabel(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.label;
}

/** "Pens, the eraser and shape recognition.": what the mode brings into focus. */
export function editorModeDescription(mode: EditorMode): string {
  return EDITOR_MODE_CATALOGUE.find((m) => m.id === mode)!.description;
}

export const DEFAULT_EDITOR_MODE: EditorMode = 'diagram';

/** The mode `step` places along the catalogue from `mode`, wrapping at either end. */
export function nextEditorMode(mode: EditorMode, step: 1 | -1 = 1): EditorMode {
  const count = EDITOR_MODES.length;
  return EDITOR_MODES[(EDITOR_MODES.indexOf(mode) + step + count) % count]!;
}

export function isEditorMode(v: unknown): v is EditorMode {
  return EDITOR_MODES.includes(v as EditorMode);
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

// "Opens in" (docs/specs/007-editor/editor-modes.md): the mode a general tab opens in, for
// everyone. Switches nobody's current mode. The same tab when nothing changes; an event-storming
// board opens in Diagram and is never given an opening mode.
export function setTabOpensIn<T extends ModeTab & { id: string }>(tab: T, mode: EditorMode): T {
  if (!editorModeSwitchable(tab) || opensInOf(tab) === mode) return tab;
  return { ...tab, opensIn: mode };
}

// The one gate every LOOK decision (the board backdrop, the ink projection, the theme being set
// aside) reads, keyed on the viewer's effective editor mode.
export function hasBoardLook(mode: EditorMode): boolean {
  return mode === 'draw';
}
