// Switch the editor to a tab, dropping every per-tab piece of selection
// state so nothing leaks across (a selected element, a multi-selection, an
// open text edit, an armed format painter). Shared by the tab bar, the embed
// tab switcher, and the Collaborators modal's Go to Tab (docs/specs/012-collaboration/collaborator-enhancements.md), which
// each used to spell the same calls out inline. Each editor binds it once, to its editor context.
type SelectTabContext = {
  setActiveId: (tabId: string) => void;
  setSelectedId: (id: null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  setEditingId: (id: null) => void;
  setFormatSourceId: (id: null) => void;
};

export function createUseSelectTab(useEditorContext: () => SelectTabContext) {
  return function useSelectTab(): (tabId: string) => void {
    const { setActiveId, setSelectedId, setMultiSelectedIds, setEditingId, setFormatSourceId } =
      useEditorContext();
    return (tabId: string) => {
      setActiveId(tabId);
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setEditingId(null);
      setFormatSourceId(null);
    };
  };
}
