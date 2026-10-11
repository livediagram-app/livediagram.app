import { editorModeLabel, modesBesidePlanRule, nextEditorMode } from '@livediagram/document';
import type { EditorModeState } from './useEditorMode';

// Shift+D (docs/specs/007-editor/editor-modes.md "The mode switch"): move to the next editor mode
// and say so in the polite live region ("Draw mode"), since a key gives no visual hint of what it
// did to someone who cannot see the switch. Null where the switch is not offered (a view-role
// visitor, an event-storming board), so the key does nothing there.
export function editorModeShortcut(
  { mode, setMode, canSwitch }: EditorModeState,
  announce: (message: string) => void,
): (() => void) | null {
  // Only the modes beside the tab's own (never into or out of Plan): on a Plan tab, none.
  const modes = modesBesidePlanRule(mode);
  if (!canSwitch || modes.length < 2) return null;
  return () => {
    const next = nextEditorMode(mode, 1, modes);
    setMode(next);
    announce(`${editorModeLabel(next)} mode`);
  };
}
