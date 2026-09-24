import { useEditorContext } from './EditorContext';

// Switch the editor to a tab, dropping every per-tab piece of selection
// state so nothing leaks across (a selected element, a multi-selection, an
// open text edit, an armed format painter or group source). Shared by the
// tab bar, the embed tab switcher, and the Collaborators modal's Go to Tab
// (spec/145), which each used to spell the same six calls out inline.
export function useSelectTab(): (tabId: string) => void {
  const {
    setActiveId,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    setFormatSourceId,
    setGroupSourceId,
  } = useEditorContext();
  return (tabId: string) => {
    setActiveId(tabId);
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };
}
