import { useEffect, useRef } from 'react';
import { guestName } from '@liveknowledge/knowledge';
import {
  articlesOf,
  sameArticleValue,
  withArticleFlow,
  draftDiffers,
  draftOf,
  holdsDraft,
  savedChangesUnderDraft,
  savedFlowOf,
  withDraftDiscarded,
  withDraftSaved,
  savedArticleOf,
  type ArticleBlock,
  type Tab,
} from '@liveknowledge/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { articleHandleOf } from '@/lib/article/article-editor-store';
import { mayEditPage } from '@/lib/page-edit/page-edit-roles';
import {
  onPeerSaved,
  pageEditorsOf,
  setMyEditingPage,
  setLeaveGuard,
  notePageSaved,
  myEditingPage,
  usePageEditors,
} from '@/lib/page-edit/page-edit-store';
import { newEditorOf } from '@/lib/page-edit/follow-editors';
import { flashMode } from '@/components/page-edit/mode-flash';
import { pageEditKeyAction } from '@/lib/page-edit/page-edit-keys';
import { wantsTitleFocus } from '@/lib/page-title-focus';
import { track } from '@/lib/telemetry';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import { clearLivePageTitle } from '@/lib/article/live-page-title';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorPages } from './useEditorPages';

// Read mode and edit mode on a page (docs/specs/030-knowledgebase/editing.md; blueprint blueprints/editing.md
// "Behaviour and state"): Edit, Save, Cancel and Discard, who is editing told to the room, a peer's save told here,
// the keys (E, Mod-S, Escape), a page made here opening to write, and leaving the page leaving edit mode. The draft
// itself is written by the commit choke point through the lens (useEditorDocument, lib/page-edit/lens.ts).
export function useEditorPageEditing({
  documentSlice,
  selectionSlice,
  sessionSlice,
  collaborationSlice,
  pagesSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
  pagesSlice: EditorPages;
}) {
  'use no memo';
  const {
    editingTabId,
    setEditingTabIdState,
    pageEditRef,
    commitTabs,
    commitRealTabs,
    resetTabs,
    tabs,
    accountUserId,
  } = documentSlice;
  const { activeId } = selectionSlice;
  const { confirm, toast, isReadOnly, participant, roomRef, selfParticipant } = sessionSlice;
  const { pageTab } = collaborationSlice;
  const { activeTabLoadState, activeTabConnected } = pagesSlice;
  const mayEdit = mayEditPage({
    isReadOnly,
    participating: participant.participating,
    connected: activeTabConnected,
    loaded: activeTabLoadState === 'ready',
  });
  // When this editing session began, and whose draft it opened onto: the bar says "Unsaved changes from Priya, 2
  // hours ago" for a draft someone left, and "Unsaved changes" for one made in this session.
  const sessionRef = useRef<{ tabId: string; since: number } | null>(null);
  const tabsNow = useRef(tabs);
  tabsNow.current = tabs;
  const realOf = (id: string): Tab | undefined => tabsNow.current.find((t) => t.id === id);

  const enter = (tabId: string | null) => {
    pageEditRef.current =
      tabId === null
        ? null
        : {
            tabId,
            writer: {
              // A guest's stamp says so: "Bright Marlin (Guest)" (owner 2026-11-21).
              by: accountUserId
                ? selfParticipant.name.trim() || 'Guest'
                : guestName(selfParticipant.name),
              now: () => Date.now(),
            },
          };
    sessionRef.current = tabId === null ? null : { tabId, since: Date.now() };
    setEditingTabIdState(tabId);
    setMyEditingPage(tabId);
    roomRef.current?.send({ kind: 'op', op: { kind: 'page-editing', tabId } });
  };
  // Undo belongs to one editing session: it never reaches behind Edit, nor undoes a Save or a Discard.
  const resetHistory = () => resetTabs((ts) => ts);

  const start = () => {
    if (!mayEdit || editingTabId === pageTab.id) return;
    debugLog('[page-edit] edit', { tabId: pageTab.id, draft: holdsDraft(pageTab) });
    track('Tab', 'Started', 'Edit');
    resetHistory();
    enter(pageTab.id);
    flashMode('edit');
  };

  // The writing still waiting on its idle commit lands first, through the lens, into the draft: all of it as typed,
  // even a paragraph whose hold the room has not answered yet, since Save is the person's word that it is written.
  const flushWriting = (tab: Tab): ArticleBlock[] | null => {
    const flow = savedFlowOf(tab);
    const handle = flow ? articleHandleOf(flow) : undefined;
    if (!flow || !handle) return null;
    handle.flush();
    const typed = handle.takeBlocks();
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== tab.id) return t;
        const doc = articlesOf(t)[flow];
        if (!doc || sameArticleValue(doc.blocks, typed)) return t;
        return withArticleFlow(t, flow, { ...doc, blocks: typed });
      }),
    );
    return typed;
  };

  const save = () => {
    const tabId = editingTabId;
    if (!tabId) return;
    const before = realOf(tabId);
    if (before) flushWriting(before);
    // Read after the flush's commit is queued: the commit below maps the newest tabs, so it saves that writing too.
    const changed = before ? draftDiffers(before) || draftOf(before) !== null : false;
    commitRealTabs((ts) =>
      ts.map((t) => (t.id === tabId && holdsDraft(t) ? withDraftSaved(t) : t)),
    );
    resetHistory();
    enter(null);
    flashMode('save');
    roomRef.current?.send({ kind: 'op', op: { kind: 'page-saved', tabId } });
    notePageSaved(tabId);
    debugLog('[page-edit] saved', { tabId, changed });
    track('Tab', 'Ended', 'Save');
    toast.success('Page saved');
  };

  const discard = (tabId: string) => {
    commitRealTabs((ts) =>
      ts.map((t) => (t.id === tabId && holdsDraft(t) ? withDraftDiscarded(t) : t)),
    );
    resetHistory();
    enter(null);
    flashMode('cancel');
    // The tree named the page from the draft's Title: it goes back to the saved name.
    clearLivePageTitle();
    debugLog('[page-edit] discarded', { tabId });
    track('Tab', 'Ended', 'Discard');
  };

  // Out of edit mode at once, its draft dropped, with no flash and no toast: for a writer that replaces the page whole
  // (a structure picked, a Describe to Set Up suggestion, on the untouched Start Here a new knowledgebase opens in
  // edit mode on), so what it writes is the saved page, never a draft lost on a reload.
  const release = (tabId: string) => {
    if (pageEditRef.current?.tabId !== tabId) return;
    commitRealTabs((ts) =>
      ts.map((t) => (t.id === tabId && holdsDraft(t) ? withDraftDiscarded(t) : t)),
    );
    resetHistory();
    enter(null);
    debugLog('[page-edit] released', { tabId });
  };

  const cancel = async () => {
    const tabId = editingTabId;
    if (!tabId) return;
    const real = realOf(tabId);
    const typed = real ? flushWriting(real) : null;
    // Others editing keep the draft: leaving changes nothing of it.
    if (pageEditorsOf(tabId).length > 0) {
      debugLog('[page-edit] cancelled, others editing', { tabId });
      resetHistory();
      enter(null);
      flashMode('cancel');
      clearLivePageTitle();
      return;
    }
    // What is typed counts though its commit has not rendered yet: the tabs here are this render's.
    const saved = real ? savedArticleOf(real) : undefined;
    const typedDiffers = typed !== null && (!saved || !sameArticleValue(typed, saved.blocks));
    if (!real || (!draftDiffers(real) && !typedDiffers)) {
      discard(tabId);
      return;
    }
    const ok = await confirm({
      title: 'Discard your changes to this page?',
      message: 'Nobody else is editing it, so your changes go for good.',
      confirmLabel: 'Discard Changes',
      cancelLabel: 'Keep Editing',
    });
    // Still editing that page, and still the last one: someone may have joined while the question was open.
    if (!ok || pageEditRef.current?.tabId !== tabId) return;
    if (pageEditorsOf(tabId).length > 0) {
      resetHistory();
      enter(null);
      flashMode('cancel');
      clearLivePageTitle();
      return;
    }
    discard(tabId);
  };

  // Leaving the page (another page, a tab closed, the role taken away) leaves edit mode; the draft stays.
  const editingAway = editingTabId !== null && (editingTabId !== activeId || !mayEdit);
  useEffect(() => {
    if (!editingAway) return;
    debugLog('[page-edit] left', { tabId: pageEditRef.current?.tabId });
    enter(null);
    // oxlint-disable-next-line react/exhaustive-deps -- runs when the page or the role moves away, not per render
  }, [editingAway]);
  // Leaving with unsaved changes (owner 2026-11-21: "require me to cancel or save it before navigating"): another
  // page asks to save first, Keep Editing stays; Cancel on the bar is the way to throw the changes away. A page with
  // nothing unsaved, or others still editing the draft, just leaves edit mode as before. Read through a ref, so the
  // question always sees this render's draft.
  const unsavedNow = (): boolean => {
    const tabId = editingTabId;
    if (!tabId || pageEditorsOf(tabId).length > 0) return false;
    const real = realOf(tabId);
    if (!real) return false;
    const typed = flushWriting(real);
    const saved = savedArticleOf(real);
    return (
      draftDiffers(real) || (typed !== null && (!saved || !sameArticleValue(typed, saved.blocks)))
    );
  };
  const leaveRef = useRef({ unsavedNow, save });
  leaveRef.current = { unsavedNow, save };
  useEffect(() => {
    setLeaveGuard((_to, go) => {
      if (!leaveRef.current.unsavedNow()) {
        go();
        return;
      }
      void confirm({
        title: 'Save Your Changes First?',
        message:
          'This page has unsaved changes. Save them to leave, or keep editing and Cancel to discard them.',
        confirmLabel: 'Save and Leave',
        cancelLabel: 'Keep Editing',
      }).then((ok) => {
        if (!ok) return;
        leaveRef.current.save();
        go();
      });
    });
    // A tab closed or reloaded with unsaved changes: the browser's own question (the draft is kept either way).
    const onUnload = (e: BeforeUnloadEvent) => {
      if (myEditingPage() !== null && leaveRef.current.unsavedNow()) e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      setLeaveGuard(null);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [confirm]);
  // The editor closing tells the room nothing more: its socket goes with it. This browser forgets the mode.
  useEffect(() => () => setMyEditingPage(null), []);

  // A page made here opens to be written (editing.md "Edit mode"): its Title takes the caret once the lens opens.
  useEffect(() => {
    if (mayEdit && editingTabId !== activeId && wantsTitleFocus(activeId)) {
      debugLog('[page-edit] new page opens editing', { tabId: activeId });
      enter(activeId);
    }
    // oxlint-disable-next-line react/exhaustive-deps -- once the opened page may be edited
  }, [activeId, mayEdit]);

  // Someone starting to edit this page (or editing it when it opens) brings this editor into edit mode with them, so
  // their typing shows live (follow-editors.ts). A Viewer never may edit, so stays reading the saved page. Only a
  // newcomer pulls: Cancel while others edit leaves this editor reading until someone else starts.
  const editorsHere = usePageEditors(activeId);
  const seenEditors = useRef<{ tabId: string; ids: string[] }>({ tabId: activeId, ids: [] });
  useEffect(() => {
    const seen = seenEditors.current;
    const before = seen.tabId === activeId ? seen.ids : [];
    const newcomer = newEditorOf(before, editorsHere);
    seenEditors.current = { tabId: activeId, ids: editorsHere.map((p) => p.id) };
    if (!newcomer || !mayEdit || editingTabId === activeId) return;
    debugLog('[page-edit] joining', { tabId: activeId, with: newcomer.id });
    track('Tab', 'Started', 'EditJoined');
    resetHistory();
    enter(activeId);
    flashMode('edit');
    toast.info(`${newcomer.name} started editing. You're editing with them.`);
    // oxlint-disable-next-line react/exhaustive-deps -- runs when the people editing, the page or the role change
  }, [editorsHere, activeId, mayEdit]);

  // A peer's save, told to whoever is editing that page.
  const editingNow = useRef(editingTabId);
  editingNow.current = editingTabId;
  useEffect(
    () =>
      onPeerSaved((tabId, name) => {
        if (editingNow.current !== tabId) return;
        debugLog('[page-edit] peer saved', { tabId });
        toast.info(`${name} saved the page`);
      }),
    [toast],
  );

  // E to Edit, Mod-S to Save, Escape to Cancel (blueprint "Presentation and UX" "Keys").
  const latest = useRef({ start, save, cancel, editing: editingTabId !== null, mayEdit });
  latest.current = { start, save, cancel, editing: editingTabId !== null, mayEdit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current;
      const action = pageEditKeyAction(e, { editing: l.editing, mayEdit: l.mayEdit });
      if (!action) return;
      e.preventDefault();
      if (action === 'edit') l.start();
      else if (action === 'save') l.save();
      else void l.cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const editing = editingTabId !== null && editingTabId === pageTab.id;
  return {
    pageEditing: {
      editing,
      mayEdit,
      since: editing ? (sessionRef.current?.since ?? 0) : 0,
      agentChanges: editing ? savedChangesUnderDraft(pageTab) : 0,
      start,
      save,
      cancel,
      release,
    },
  };
}

export type EditorPageEditing = ReturnType<typeof useEditorPageEditing>;
