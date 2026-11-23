import { actionNoteOpens } from '@/lib/action-note-open';
import { CUT_FROM_FORK } from '@/lib/not-in-liveknowledge';
import { useMemo, useRef } from 'react';
import { isBoxed, elementActions } from '@liveknowledge/document';
import { useArticles } from '@/hooks/editor/useArticles';
import { usePageTitleFocus } from '@/hooks/editor/usePageTitleFocus';
import { pageDeckControls } from '@/lib/page-deck-controls';
import { useElementCreation } from '../useElementCreation';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorComments } from './useEditorComments';
import type { EditorPages } from './useEditorPages';
import type { EditorHistory } from './useEditorUndoState';

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
  const { localEditSeqRef, tickTabs, commitTabs } = documentSlice;
  const { activeId, setSelectedId, setMultiSelectedIds } = selectionSlice;
  const { openComments, isReadOnly, participant } = sessionSlice;
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
    placeAt: (intent, x, y, size) => placeIntentAtRef.current?.(intent, x, y, size),
    canEdit: !isReadOnly,
    // A Participant writes in an article too (docs/specs/013-workspace/share-roles.md), each commit through its guard.
    canWrite: participant.participating && participant.can.writeArticle,
    // A Title names its page and nothing else (usePageNameFromTitle): the knowledgebase keeps "Untitled Knowledgebase"
    // until a person names it (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase").
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
    // Not while the view glides to a page just added: that frame brings its writing into view (usePagesMode framing).
    reveal: (x, y, w, h) => {
      if (pagesMode.framing?.()) return;
      scrollIntoView(x, y, w, h);
    },
  });
  useAssignRef(articleFocusRef, (flow: string) => articles?.requestFocus(flow, 'start'));
  // A page made here (New Page, Add Subpage, Create Page, a new knowledgebase's first) opens with the caret in its
  // Title (usePageTitleFocus).
  const requestArticleFocus = articles?.requestFocus;
  usePageTitleFocus({
    activeTab,
    editable: !isReadOnly,
    focusTitle: requestArticleFocus
      ? (flow, from) => requestArticleFocus(flow, 'title', from)
      : null,
  });
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
  // The verbs are new on every render (a typing commit among them), so the controls call the newest through a ref and
  // change only with the deck, the tab and the role (docs/specs/007-editor/blueprints/typing.md "Performance and
  // limits": the chrome showing the pages renders for none of those commits).
  const deckVerbs = useLatest({
    newPageSlide,
    toggleSlideHidden,
    setSlideNoteCards,
    flushDeckSave,
    start: startDeck,
  });
  const pageDeck = useMemo(
    () =>
      pageDeckControls(currentDeck, activeId, !isReadOnly, {
        newPageSlide: (pageId) => deckVerbs.current.newPageSlide(pageId),
        toggleSlideHidden: (slideId) => deckVerbs.current.toggleSlideHidden(slideId),
        setSlideNoteCards: (slideId, cards) => deckVerbs.current.setSlideNoteCards(slideId, cards),
        flushDeckSave: () => deckVerbs.current.flushDeckSave(),
        start: (fromSlideId) => deckVerbs.current.start(fromSlideId),
      }),
    [currentDeck, activeId, isReadOnly, deckVerbs],
  );
  const pagesModeView = useMemo(
    // No deck: a knowledgebase page is never a slide, so no Notes, Add to Slides or Present From Here.
    () => ({
      ...pagesMode,
      ...(articles ? { articles } : {}),
      ...(CUT_FROM_FORK ? { deck: pageDeck } : {}),
    }),
    [pagesMode, articles, pageDeck],
  );

  return { placeIntentAtRef, pagesModeView };
}

export type EditorArticles = ReturnType<typeof useEditorArticles>;
