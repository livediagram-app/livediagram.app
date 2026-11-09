'use client';

import { useEditorUiState } from '../editor-ui-state';
import { useTabScope } from '@liveworkspace/workbench/hooks/editor/useTabScope';
import type { EditorDocumentSlice } from './useEditorDocument';

// The active tab and the selection (single, multi, editing, format source), guarded by a tab-scoped share
// session's one tab. A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it
// and returns its own, with `view`, its part of the editor's view-model.
export function useEditorSelection({ fromDocument }: { fromDocument: EditorDocumentSlice }) {
  const { initialTabs } = fromDocument;

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
    activeId,
    editingId,
    formatSourceId,
    identityPromptOpen,
    readSelection,
    selectionStore,
    sessionTabScope,
    setActiveId,
    setEditCursorAtEnd,
    setEditingId,
    setFormatSourceId,
    setIdentityPromptOpen,
    setMultiSelectedIds,
    setSelectedId,
    setSessionTabScope,
    tabScopeRef,
    view: {
      // Tab-scoped share session (docs/specs/013-workspace/tab-scoped-share-links.md).
      sessionTabScope,
      isOutOfScope,
      ...uiState,
    },
  };
}

export type EditorSelectionSlice = ReturnType<typeof useEditorSelection>;
