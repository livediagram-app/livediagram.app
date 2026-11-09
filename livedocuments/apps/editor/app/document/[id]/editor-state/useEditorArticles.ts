import { actionNoteOpens } from '@/lib/action-note-open';
import { useMemo, useRef } from 'react';
import { isBoxed, elementActions } from '@livedocuments/document';
import { useArticles } from '@/hooks/editor/useArticles';
import { articleTitleName } from '@/lib/article/article-document-name';
import { pageDeckControls } from '@/lib/page-deck-controls';
import { useElementCreation } from '../useElementCreation';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorComments } from './useEditorComments';
import type { EditorPages } from './useEditorPages';
import type { EditorHistory } from './useEditorHistory';

// The article pages' writing (useArticles) and the page deck controls, folded into the Pages mode view.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorArticles({
  documentSlice,
  selectionSlice,
  sessionSlice,
  collaborationSlice,
  viewportSlice,
  commentsSlice,
  pagesSlice,
  historySlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  commentsSlice: EditorComments;
  pagesSlice: EditorPages;
  historySlice: EditorHistory;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { tabs, localEditSeqRef, tickTabs, commitTabs } = documentSlice;
  const { activeId, setSelectedId, setMultiSelectedIds } = selectionSlice;
  const { openComments, documentName, setDocumentName, isReadOnly, participant } = sessionSlice;
  const { activeTab } = collaborationSlice;
  const { scrollIntoView, slideDeck } = viewportSlice;
  const { openActionPopover, openAssignActionDialog } = commentsSlice;
  const { articleFocusRef, pagesMode, guardedCommitTabs } = pagesSlice;
  const { undo, redo } = historySlice;
  // The writing of the active tab's article pages (docs/specs/007-editor/article-pages.md); read only while a page
  // slide presents.
  const articles = useArticles({
    activeTab,
    on: true,
    pages: pagesMode.pages,
    localEditSeq: localEditSeqRef,
    placeAt: (intent, x, y) => placeIntentAtRef.current?.(intent, x, y),
    canEdit: !isReadOnly,
    // A Participant writes in an article too (docs/specs/013-workspace/share-roles.md), each commit through its guard.
    canWrite: participant.participating && participant.can.writeArticle,
    // An article's Title names a still-untitled document, as the first label does (a Participant names nothing).
    onWritten: (flow, blocks) => {
      if (isReadOnly) return;
      const name = articleTitleName(documentName, tabs[0], flow, blocks);
      if (name) setDocumentName(name);
    },
    commitTabs: participant.participating ? guardedCommitTabs : commitTabs,
    tickTabs,
    undo,
    redo,
    clearSelection: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    openNote: (id, kind) => {
      if (kind === 'comment') return openComments(id);
      // An action already assigned shows in its popover; a new one opens the dialog to assign it, for an Editor
      // only (actionNoteOpens).
      const el = activeTab.elements.find((e) => e.id === id);
      const opens = actionNoteOpens(
        !!el && isBoxed(el) && elementActions(el).length > 0,
        isReadOnly,
      );
      if (opens === 'popover') openActionPopover(id);
      else if (opens === 'assign') openAssignActionDialog(id);
    },
    reveal: (x, y, w, h) => scrollIntoView(x, y, w, h),
  });
  useAssignRef(articleFocusRef, (flow: string) => articles?.requestFocus(flow, 'start'));
  // Set once element creation exists (below): an Insert at the caret places through it.
  const placeIntentAtRef = useRef<ReturnType<typeof useElementCreation>['placeIntentAt'] | null>(
    null,
  );
  // A page's Add to Slides / Present From Here / Hide in Slides (its Contents menu) and Notes reach the deck
  // (pageDeckControls). Memoised so the pages' view keeps its identity across renders where nothing changed.
  const {
    deck: currentDeck,
    newPageSlide,
    toggleSlideHidden,
    setSlideNoteCards,
    flushDeckSave,
    start: startDeck,
  } = slideDeck;
  const pageDeck = useMemo(
    () =>
      pageDeckControls(currentDeck, activeId, !isReadOnly, {
        newPageSlide,
        toggleSlideHidden,
        setSlideNoteCards,
        flushDeckSave,
        start: startDeck,
      }),
    [
      currentDeck,
      activeId,
      isReadOnly,
      newPageSlide,
      toggleSlideHidden,
      setSlideNoteCards,
      flushDeckSave,
      startDeck,
    ],
  );
  const pagesModeView = useMemo(
    () => ({ ...pagesMode, ...(articles ? { articles } : {}), deck: pageDeck }),
    [pagesMode, articles, pageDeck],
  );

  return { placeIntentAtRef, pagesModeView };
}

export type EditorArticles = ReturnType<typeof useEditorArticles>;
