import { editorModeLabel, nextEditorMode, type EditorMode } from '@livediagram/document';
import type { EditorModeState } from './useEditorMode';
import { offeredEditorModes } from '@/lib/offered-editor-modes';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): move to the next editor mode
// and say so in the polite live region ("Draw mode"), since a key gives no visual hint of what it
// did to someone who cannot see the switch. Null where the switch is not offered (a view-role
// visitor, an event-storming board), so the key does nothing there.
// `stays` names a switch that will not happen (a Plan tab with content, which asks instead), so the
// key says nothing of a mode it did not reach.
export function editorModeShortcut(
  { mode, setMode, canSwitch }: EditorModeState,
  announce: (message: string) => void,
  stays: (next: EditorMode) => boolean = () => false,
): (() => void) | null {
  if (!canSwitch) return null;
  return () => {
    const next = nextEditorMode(mode, 1, offeredEditorModes());
    setMode(next);
    if (!stays(next)) announce(`${editorModeLabel(next)} mode`);
  };
}
