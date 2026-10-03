import type { EditorModeState } from '@/hooks/editor/useEditorMode';
import { EditorModeSwitch } from './EditorModeSwitch';

// The tab bar's mode switch slot (docs/specs/007-editor/editor-modes.md "The mode switch"): left
// end of the bar, before the Tabs label, showing the editor's own resolved mode for the active tab
// (never a second resolution, so the switch and the canvas cannot disagree). A
// visitor who cannot edit gets no slot at all (their role does not change between tabs); a tab that
// offers no switch (an event-storming board) keeps the slot, empty, so the tabs never jump.
// `powerUser` swaps the chip for the icon pill, in the same slot.
export function EditorModeSwitchSlot({
  editorMode,
  powerUser,
}: {
  editorMode: EditorModeState;
  powerUser: boolean;
}) {
  const { mode, setMode, canSwitch, canEdit } = editorMode;
  if (!canEdit) return null;
  return (
    <EditorModeSwitch compact={powerUser} hidden={!canSwitch} mode={mode} onChange={setMode} />
  );
}
