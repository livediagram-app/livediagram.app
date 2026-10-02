import type { Tab } from '@livediagram/document';
import { useEditorMode } from '@/hooks/editor/useEditorMode';
import { EditorModeSwitch } from './EditorModeSwitch';
import { useModeSwitchVariant } from './mode-switch-variant';

// The tab bar's mode switch slot (docs/specs/007-editor/editor-modes.md "The mode
// switch"): left end of the bar, before the TABS label, bound to the person's
// editor mode for the active tab. A visitor who cannot edit gets no slot at
// all (their role does not change between tabs); a tab that offers no switch
// (an event-storming board) keeps the slot, empty, so the tabs never jump.
//
// PROTOTYPING: the variant comes from `?modeSwitch=` until the operator picks.
export function EditorModeSwitchSlot({
  activeTab,
  canEdit,
}: {
  activeTab: Tab | undefined;
  canEdit: boolean;
}) {
  const variant = useModeSwitchVariant();
  const { mode, setMode, canSwitch } = useEditorMode(activeTab, { canEdit });
  if (!canEdit) return null;
  return <EditorModeSwitch variant={variant} hidden={!canSwitch} mode={mode} onChange={setMode} />;
}
