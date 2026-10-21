import { EDITOR_MODES, editorModeLabel, nextEditorMode } from '@liveplanner/document';
import type { EditorModeState } from './useEditorMode';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): move to the next editor mode
// and say so in the polite live region ("Draw mode"), since a key gives no visual hint of what it
// did to someone who cannot see the switch. Only on an empty tab, where the start's own switch is: a tab with
// content keeps its mode, and a new tab is the way to work on it in another. Null elsewhere (a tab with content, a
// view-role visitor, a Plan tab), so the key does nothing there.
export function editorModeShortcut(
  { mode, setMode, canSwitch, crossPlan }: EditorModeState,
  announce: (message: string) => void,
): (() => void) | null {
  // An empty tab (crossPlan) cycles every mode.
  if (!canSwitch || !crossPlan) return null;
  return () => {
    const next = nextEditorMode(mode, 1, EDITOR_MODES);
    setMode(next);
    announce(`${editorModeLabel(next)} mode`);
  };
}
