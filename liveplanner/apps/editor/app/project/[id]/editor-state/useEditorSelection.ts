import { useEditorUiState } from '../editor-ui-state';
import { useTabScope } from '../useTabScope';
import type { EditorEnvSlice } from './useEditorEnv';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The active tab, the selection and the edit in progress (editor-ui-state), and a tab-scoped session's one tab.
export function useEditorSelection(env: EditorEnvSlice) {
  const { initialTabs } = env;
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
    setMultiSelectedIds,
    identityPromptOpen,
    setIdentityPromptOpen,
  } = uiState;
  return {
    activeId,
    editingId,
    identityPromptOpen,
    isOutOfScope,
    readSelection,
    selectionStore,
    sessionTabScope,
    setActiveId,
    setEditCursorAtEnd,
    setEditingId,
    setIdentityPromptOpen,
    setMultiSelectedIds,
    setSelectedId,
    setSessionTabScope,
    uiState,
  };
}

export type EditorSelectionSlice = ReturnType<typeof useEditorSelection>;
