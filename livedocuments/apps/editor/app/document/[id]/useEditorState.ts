'use client';

import type { EditorSurface } from '@liveworkspace/workbench/lib/editor-surface';
import { editorView } from './editor-state/editor-view';
import { useEditorArticles } from './editor-state/useEditorArticles';
import { useEditorCollaboration } from './editor-state/useEditorCollaboration';
import { useEditorComments } from './editor-state/useEditorComments';
import { useEditorDocument } from './editor-state/useEditorDocument';
import { useEditorElements } from './editor-state/useEditorElements';
import { useEditorUndoState } from './editor-state/useEditorUndoState';
import { useEditorInput } from './editor-state/useEditorInput';
import { useEditorLayers } from './editor-state/useEditorLayers';
import { useEditorPages } from './editor-state/useEditorPages';
import { useEditorPersistence } from './editor-state/useEditorPersistence';
import { useEditorSelection } from './editor-state/useEditorSelection';
import { useEditorSession } from './editor-state/useEditorSession';
import { useEditorStyle } from './editor-state/useEditorStyle';
import { useEditorTabs } from './editor-state/useEditorTabs';
import { useEditorTools } from './editor-state/useEditorTools';
import { useEditorViewport } from './editor-state/useEditorViewport';
import { useEditorWorkbench } from './editor-state/useEditorWorkbench';

// The editor's state: every hook the document page runs, composed in one order, and the one view-model
// EditorContext hands the editor (docs/development/architecture.md "Editor state").
//
// Each concern is a hook in editor-state/ that takes the slices before it and returns the values the ones after it
// read. They run in this order and no other: a hook's effects run in call order, and several of them rely on
// another's having run first (the tabs ref is current before the room seeds from it, the stored deck hydrates before
// its follow pass, the deck's view capture runs before the slide fit). Dependencies flow one way, down this list; a
// value a hook needs from one further down reaches it through a ref declared up the list and filled further down
// (the active layer's stamp, the changeset reveal, the Insert at the caret, the mention notify).
//
// editorView picks the view-model's fields out of the slices, in the order and shape the editor has always read.
//
// None of it is memoised by the React Compiler: it bailed out on the single hook these slices were cut from, and
// each slice says 'use no memo' so the split changes nothing at runtime. Most slices now compile; letting them is a
// change of its own, to be measured (render counts, the perf budgets) before it lands.
export function useEditorState(opts: { surface?: EditorSurface } = {}) {
  'use no memo';
  const documentSlice = useEditorDocument(opts);
  const selectionSlice = useEditorSelection({ documentSlice });
  const toolsSlice = useEditorTools({ documentSlice, selectionSlice });
  const sessionSlice = useEditorSession({ documentSlice, selectionSlice, toolsSlice });
  const persistenceSlice = useEditorPersistence({ documentSlice, selectionSlice, sessionSlice });
  const collaborationSlice = useEditorCollaboration({
    documentSlice,
    selectionSlice,
    toolsSlice,
    sessionSlice,
    persistenceSlice,
  });
  const viewportSlice = useEditorViewport({
    documentSlice,
    selectionSlice,
    sessionSlice,
    persistenceSlice,
    collaborationSlice,
  });
  const commentsSlice = useEditorComments({
    documentSlice,
    selectionSlice,
    toolsSlice,
    sessionSlice,
    collaborationSlice,
    viewportSlice,
  });
  const pagesSlice = useEditorPages({
    documentSlice,
    selectionSlice,
    sessionSlice,
    persistenceSlice,
    collaborationSlice,
    viewportSlice,
    commentsSlice,
  });
  const layersSlice = useEditorLayers({
    documentSlice,
    selectionSlice,
    sessionSlice,
    persistenceSlice,
    collaborationSlice,
    pagesSlice,
  });
  const historySlice = useEditorUndoState({ documentSlice, selectionSlice, pagesSlice });
  const articlesSlice = useEditorArticles({
    documentSlice,
    selectionSlice,
    sessionSlice,
    collaborationSlice,
    viewportSlice,
    commentsSlice,
    pagesSlice,
    historySlice,
  });
  const tabsSlice = useEditorTabs({
    documentSlice,
    selectionSlice,
    sessionSlice,
    collaborationSlice,
    viewportSlice,
    pagesSlice,
  });
  const elementsSlice = useEditorElements({
    documentSlice,
    selectionSlice,
    toolsSlice,
    sessionSlice,
    collaborationSlice,
    viewportSlice,
    commentsSlice,
    pagesSlice,
    layersSlice,
    historySlice,
    articlesSlice,
    tabsSlice,
  });
  const styleSlice = useEditorStyle({
    documentSlice,
    selectionSlice,
    sessionSlice,
    persistenceSlice,
    collaborationSlice,
    pagesSlice,
    layersSlice,
    tabsSlice,
    elementsSlice,
  });
  const inputSlice = useEditorInput({
    documentSlice,
    selectionSlice,
    toolsSlice,
    sessionSlice,
    collaborationSlice,
    viewportSlice,
    commentsSlice,
    pagesSlice,
    layersSlice,
    historySlice,
    tabsSlice,
    elementsSlice,
    styleSlice,
  });
  useEditorWorkbench({
    documentSlice,
    selectionSlice,
    sessionSlice,
    persistenceSlice,
    collaborationSlice,
  });
  return editorView({
    documentSlice,
    selectionSlice,
    toolsSlice,
    sessionSlice,
    persistenceSlice,
    collaborationSlice,
    viewportSlice,
    commentsSlice,
    pagesSlice,
    layersSlice,
    historySlice,
    articlesSlice,
    tabsSlice,
    elementsSlice,
    styleSlice,
    inputSlice,
  });
}
