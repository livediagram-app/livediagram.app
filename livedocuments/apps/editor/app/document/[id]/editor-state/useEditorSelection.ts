import { useEditorUiState } from '../editor-ui-state';
import { useTabScope } from '@liveworkspace/workbench/hooks/editor/useTabScope';
import type { EditorDocument } from './useEditorDocument';

// The selection and the active tab: the tab-scoped share session's one tab, and the ephemeral selection / edit
// state (editor-ui-state) the rest of the editor reads and writes.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorSelection({ documentSlice }: { documentSlice: EditorDocument }) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { initialTabs } = documentSlice;
  // Ephemeral selection / edit UI (active tab, single + multi selection,
  // edit + format-painter source, the two transient picker flags). See
  // editor-ui-state. Destructured here because the body references these
  // names directly throughout; the whole slice is spread into the
  // returned view-model below (the `...panelLayout` / `...dialogs`
  // convention), so the explicit return doesn't re-list these.
  // A tab-scoped share session's one tab (docs/specs/013-workspace/tab-scoped-share-links.md). Created first:
  // the active-tab guard in editor-ui-state reads its ref.
  const tabScope = useTabScope();
  const { sessionTabScope, setSessionTabScope, tabScopeRef, isOutOfScope } = tabScope;
  const uiState = useEditorUiState(initialTabs[0]!.id, tabScopeRef);
  const {
    activeId,
    setActiveId,
    readSelection,
    selectionStore,
    setSelectedId,
    editingId,
    setEditingId,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    setMultiSelectedIds,
    identityPromptOpen,
    setIdentityPromptOpen,
  } = uiState;

  return {
    sessionTabScope,
    setSessionTabScope,
    isOutOfScope,
    uiState,
    activeId,
    setActiveId,
    readSelection,
    selectionStore,
    setSelectedId,
    editingId,
    setEditingId,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    setMultiSelectedIds,
    identityPromptOpen,
    setIdentityPromptOpen,
  };
}

export type EditorSelection = ReturnType<typeof useEditorSelection>;
