import { EDITOR_MODES, editorModeLabel, nextEditorMode } from '@livehuddle/document';
import type { EditorModeState } from './useEditorMode';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): move to the next editor mode
// and say so in the polite live region ("Draw mode"), since a key gives no visual hint of what it
// did to someone who cannot see the switch. Wherever the switch is offered, on a tab with content as on an empty
// one. Null elsewhere (a Participant or a Viewer, a locked tab, an event-storming board), so the key does nothing
// there.
export function editorModeShortcut(
  { mode, setMode, canSwitch }: EditorModeState,
  announce: (message: string) => void,
): (() => void) | null {
  if (!canSwitch) return null;
  return () => {
    const next = nextEditorMode(mode, 1, EDITOR_MODES);
    setMode(next);
    announce(`${editorModeLabel(next)} mode`);
  };
}
