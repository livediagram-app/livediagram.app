import type { Tab } from '@livediagram/document';
import { useEditorMode } from '@/hooks/editor/useEditorMode';
import { EditorModeSwitch } from './EditorModeSwitch';

// The tab bar's mode switch slot (docs/specs/007-editor/editor-modes.md "The mode switch"): left
// end of the bar, before the Tabs label, bound to the person's editor mode for the active tab. A
// visitor who cannot edit gets no slot at all (their role does not change between tabs); a tab that
// offers no switch (an event-storming board) keeps the slot, empty, so the tabs never jump.
// `powerUser` swaps the chip for the icon pill, in the same slot.
export function EditorModeSwitchSlot({
  activeTab,
  canEdit,
  powerUser,
}: {
  activeTab: Tab | undefined;
  canEdit: boolean;
  powerUser: boolean;
}) {
  const { mode, setMode, canSwitch } = useEditorMode(activeTab, { canEdit });
  if (!canEdit) return null;
  return (
    <EditorModeSwitch compact={powerUser} hidden={!canSwitch} mode={mode} onChange={setMode} />
  );
}
