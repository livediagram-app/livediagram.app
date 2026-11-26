// Tab-lifecycle actions, lifted out of editor-page.tsx: add / import /
// rename / duplicate / delete / move tabs, the active-tab lock,
// linking a tab into another document, and clearing a tab's content.
//
// A tab is a page of the knowledgebase's page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// page tree"): a page is added under a parent, deleted with its subpages, duplicated beside itself and moved with
// the tree's own checked edits (page-tree-edits.ts), and its name and its Title block are kept the same.
//
// This is the busiest of the extracted hooks because tab lifecycle
// genuinely touches a lot: history (`commit` / `commitTabs`),
// selection state, telemetry, the confirm dialog + toasts, and the
// document list.
// The deps object reflects that — the page still owns all that state;
// this hook only relocates the handlers verbatim so the logic lives in
// one auditable place. No behaviour change.
//
// NOT here: document-level lifecycle (new / open / delete / duplicate /
// move-to-folder), the template-picker flow, and the panel-accordion
// helper — those are separate concerns that stay in the page (or move
// in their own pass).

import { openPagesMax } from '@/lib/knowledge-tier';
import { useEffect, useRef } from 'react';
import {
  NEW_PAGE_NAME,
  pageAddRefusal,
  pageMoveRefusal,
  pageSubtreeIds,
  subpageCount,
  truncateName,
  withPageDeleted,
  withPageIndented,
  withPageMoved,
  withPageOutdented,
  withPageStepped,
  type PageMove,
  type Tab,
} from '@liveknowledge/document';
import { withPageTitle } from '@liveknowledge/document';
import { wantTitleFocus } from '@/lib/page-title-focus';
import { openParentsOf } from '@/lib/page-tree-open';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import {
  deletedPageMessage,
  pageAfterDelete,
  pageTreeRefusalText,
  withPageAddedTo,
  withPageAndSubpagesDeleted,
  withPageDuplicated,
} from './page-tree-edits';
import { apiLinkTab } from '@/lib/api-client';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { newTabSeed } from '@/lib/new-tab-seed';
import { track } from '@/lib/telemetry';
import { revertStep, useUndoableAction } from '@liveworkspace/ui/undo';
import type { RowFocus } from '@liveworkspace/workbench/lib/row-focus';
import { RESET_TAB_WORDS, resetTabUndoable } from '@liveworkspace/workbench/lib/tab-reset-undo';
import { remintTabElements, useTabImport } from './useTabImport';
import type { useToast } from '@/hooks/ui/useToast';
import { toastName } from '@liveworkspace/workbench/lib/toast-name';

type TabActionsDeps = {
  tabs: Tab[];
  activeId: string;
  // Whether the session may change the document's structure (its tabs): false for a view link and
  // for any tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md).
  canEditStructure: boolean;
  // The owner's document list — read for the destination name when
  // linking a tab into another document.
  documentList: { id: string; name: string }[];
  // The open document: the one a tab added elsewhere is shared from.
  documentId: string | null;
  // The local participant id (owner of the link request).
  ownerId: string;
  // Factory for a blank tab (kept in the page because the initial-state
  // initialiser also uses it).
  createTab: (name: string) => Tab;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // A change that is no undo step of its own (the page's name following its Title as it is typed).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Mark a freshly-created tab as loaded so the lazy per-tab fetch
  // (docs/specs/006-document/per-tab-storage.md) skips it — a locally-created tab has no server row to
  // pull, so without this the canvas would flash its loading overlay
  // over the new (and never-resolving) tab.
  markTabLoaded: (id: string) => void;
  // Whether a tab's content has actually been fetched (docs/specs/006-document/per-tab-storage.md).
  // Duplicate must refuse a still-loading source: copying the empty
  // placeholder and marking the copy loaded persists a permanently
  // empty tab.
  isTabLoaded: (id: string) => boolean;
  setActiveId: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  // Surfaces an import parse error in the header (null clears it).
  setImportError: (message: string | null) => void;
  // Frames the tab once replaced content has rendered (useTabEntryEffects).
  requestFit: () => void;
  // Notes an import's view and elements, so its undo can bring the view back
  // (@liveworkspace/workbench/hooks/canvas/useImportUndoView).
  noteImport?: (tabId: string, elements: readonly { id: string }[]) => void;
  // Hands an imported deck's speaker notes and hidden slides to the Slide Deck (office-import.md).
  onSlidesImported?: Parameters<typeof useTabImport>[0]['onSlidesImported'];
  // Re-pulls the owner's document list after a cross-document tab link.
  refreshDocumentList: (ownerId: string) => void;
  toast: ReturnType<typeof useToast>;
};

export function useTabActions(deps: TabActionsDeps) {
  const {
    tabs,
    activeId,
    documentList,
    ownerId,
    documentId,
    createTab,
    commitTabs,
    tickTabs,
    markTabLoaded,
    isTabLoaded,
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    requestFit,
    noteImport,
    refreshDocumentList,
    toast,
  } = deps;

  // A new page, the last subpage of `parent` or the last top-level page. It opens with the caret in its Title
  // (wantTitleFocus, answered by usePageTitleFocus once the page's writing is on screen).
  const addTab = (parent?: string) => {
    // A session that cannot change the knowledgebase's pages adds none, whichever control asked.
    if (!deps.canEditStructure) return;
    // At a limit the controls are disabled with the reason; a shortcut or the command palette hears it here.
    const refused = pageAddRefusal(tabs, parent, openPagesMax());
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return;
    }
    // The new page takes the active page's look (newTabSeed).
    // Skips the look when the active tab can't be resolved (mid-mount, or removed in another
    // window), falling back to brand defaults the same way the first page does.
    const seed = newTabSeed(tabs.find((t) => t.id === activeId));
    const tab: Tab = { ...createTab(NEW_PAGE_NAME), ...seed };
    commitTabs((ts) => withPageAddedTo(ts, tab, parent));
    markTabLoaded(tab.id);
    // A subpage shows where it went: its parents open in this reader's tree, and stay open once it is left.
    if (parent) openParentsOf(documentId, [...tabs, { id: tab.id, parent }], [tab.id]);
    track('Tab', 'Created');
    wantTitleFocus(tab.id);
    setActiveId(tab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
  };

  // A subpage made from the writing (the page link picker's Create Page, docs/specs/030-knowledgebase/
  // links-and-embeds.md): named, its Title saying its name, under `parent`, and not opened, so the writer stays
  // where they are. Answers its id, or null when it was not made.
  const addNamedSubpage = (parent: string, name: string): string | null => {
    if (!deps.canEditStructure) return null;
    const refused = pageAddRefusal(tabs, parent, openPagesMax());
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return null;
    }
    const title = truncateName(name) || NEW_PAGE_NAME;
    const seed = newTabSeed(tabs.find((t) => t.id === activeId));
    const tab: Tab = withPageTitle({ ...createTab(title), ...seed }, title);
    commitTabs((ts) => withPageAddedTo(ts, tab, parent));
    markTabLoaded(tab.id);
    // Not opened, so it shows in the tree only with its parents open.
    openParentsOf(documentId, [...tabs, { id: tab.id, parent }], [tab.id]);
    track('Tab', 'Created', 'FromPageLink');
    // Not opened now; the first time it is, the caret is at the end of its Title.
    wantTitleFocus(tab.id);
    return tab.id;
  };

  // Import (id re-mint, content replace, JSON parsing) lives in useTabImport;
  // remintTabElements is shared with the Duplicate below.
  const { importIntoActiveTab, importTextIntoActiveTab, importFileIntoActiveTab } = useTabImport({
    tabs,
    activeId,
    commitTabs,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    requestFit,
    noteImport,
    ownerId,
    documentId,
    onSlidesImported: deps.onSlidesImported,
  });

  const toggleActiveTabLock = () => {
    const target = tabs.find((t) => t.id === activeId);
    if (!target) return;
    const next = !target.locked;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, locked: next } : t)));
    track('Tab', next ? 'Locked' : 'Unlocked');
    if (next) {
      // Drop any in-progress UI state that would be useless on a
      // newly-locked tab.
      setSelectedId(null);
      setEditingId(null);
      setFormatSourceId(null);
    }
  };

  // A rename asked of a page whose writing is not held here yet: applied once it has loaded, so its Title is
  // rewritten with its name and both are saved with the page (an unloaded page's body is never saved).
  const pendingRenames = useRef(new Map<string, string>());

  const applyRename = (id: string, trimmed: string) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === id ? withPageTitle({ ...t, name: trimmed }, trimmed) : t)),
    );
    track('Tab', 'Renamed');
  };

  // Renames a page, and rewrites its Title to match (the page's name follows its Title, and the Title its name).
  const renameTab = (id: string, name: string) => {
    if (!deps.canEditStructure) return;
    const previous = tabs.find((t) => t.id === id)?.name ?? '';
    // Capped here rather than at each input, so every route in (the page tree's inline rename, the command palette,
    // an import) lands under the same limit (docs/specs/006-document/name-length.md).
    const trimmed = truncateName(name);
    if (!trimmed || trimmed === previous.trim()) return;
    if (!isTabLoaded(id)) {
      // Opening the page loads its writing; the effect below renames it then.
      pendingRenames.current.set(id, trimmed);
      setActiveId(id);
      return;
    }
    applyRename(id, trimmed);
  };

  useEffect(() => {
    if (pendingRenames.current.size === 0) return;
    for (const [id, name] of [...pendingRenames.current]) {
      const tab = tabs.find((t) => t.id === id);
      if (tab && !isTabLoaded(id)) continue;
      pendingRenames.current.delete(id);
      if (tab && tab.name !== name) applyRename(id, name);
    }
  });

  // The page's name following its Title as it is typed (the caller debounces: one write when typing stops). No
  // undo step of its own, so undoing the typing is one step. A Title emptied leaves the page unnamed, shown as
  // "Untitled Page" (knowledgebases-and-pages.md "Name").
  const renameTabFromTitle = (id: string, title: string) => {
    if (!deps.canEditStructure) return;
    const trimmed = truncateName(title);
    const tab = tabs.find((t) => t.id === id);
    if (!tab || tab.name === trimmed || tab.locked === true) return;
    tickTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
    track('Tab', 'Renamed');
  };

  // Share the active tab into another of the user's documents (docs/specs/006-document/tab-document-many-to-many.md).
  // Goes through POST /api/documents/<target>/tabs/<tabId>/link with this document as `from`: the target then holds
  // the same tab, and an edit to it in either document reaches the other.
  const linkActiveTabTo = async (targetDocumentId: string) => {
    const source = tabs.find((t) => t.id === activeId);
    if (!source || !documentId) return;
    const target =
      toastName(documentList.find((d) => d.id === targetDocumentId)?.name) ?? 'that knowledgebase';
    try {
      await apiLinkTab(ownerId, targetDocumentId, source.id, documentId);
      toast.success(`${toastName(source.name) ?? 'Page'} added to ${target}`);
      track('Tab', 'Linked');
    } catch {
      // Previously swallowed silently: the user clicked a destination
      // and nothing visible happened. The toast surfaces the failure
      // without forcing a modal; refresh still runs so the source
      // document's local state remains consistent with what landed.
      // Two names fill the line, so the try-again is left to the reader.
      toast.error(`Could not add ${toastName(source.name) ?? 'the page'} to ${target}.`);
    }
    refreshDocumentList(ownerId);
  };

  // A copy of the page beside it, under the same parent, without its subpages.
  const duplicateTab = (id: string) => {
    if (!deps.canEditStructure) return;
    const src = tabs.find((t) => t.id === id);
    // A connected tab is never duplicated (connected-tabs.md "How it looks"): a copy would hold a connection the index
    // opens only in its own tab.
    if (!src || connectionOf(src)) return;
    // The copy is one more page under the same parent: no deeper, so only the page limit can refuse it.
    const refused = pageAddRefusal(tabs, src.parent, openPagesMax());
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return;
    }
    // A still-loading source is an empty placeholder — copying it (and
    // marking the copy loaded below) would persist a permanently empty
    // page. The lazy fetch resolves in well under a second; asking the
    // user to retry beats silently duplicating nothing.
    if (!isTabLoaded(id)) {
      toast.error(`${toastName(src.name) ?? 'That page'} is still loading. Try again in a moment.`);
      return;
    }
    // Re-mint ids (arrow endpoints remapped): element ids must be
    // unique per DOCUMENT, not just per tab — verbatim copies made a
    // peer's selection of the original render (and lock, docs/specs/007-editor/editor-app.md) on
    // the copy too, since remote selections resolve by element id.
    const reminted = remintTabElements({ ...src, elements: src.elements.map((el) => ({ ...el })) });
    // Capped like every name the editor makes (docs/specs/006-document/name-length.md): a full-length name's copy ran
    // past it. The copy's Title says its name, as every page's does.
    const name = truncateName(`${src.name} copy`);
    const copy: Tab = withPageTitle({ ...reminted, id: crypto.randomUUID(), name }, name);
    commitTabs((ts) => withPageDuplicated(ts, id, copy));
    markTabLoaded(copy.id);
    setActiveId(copy.id);
    setSelectedId(null);
    setEditingId(null);
    track('Tab', 'Duplicated');
  };

  // Restorable actions act at once with an Undo toast (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md).
  const offerUndo = useUndoableAction();
  // Deletes a page and its subpages at once; the toast names the count and offers Undo. One commit, so Cmd/Ctrl-Z
  // brings them all back too. The row menu's Delete is already disabled on the last page and on a locked one; the
  // guards here are belt-and-suspenders.
  // `focus` (the page tree's RowFocus) moves keyboard focus off the gone rows, and onto the page again after Undo.
  const deleteTab = (id: string, focus?: RowFocus) => {
    if (!deps.canEditStructure) return;
    const target = tabs.find((t) => t.id === id);
    const gone = new Set(pageSubtreeIds(tabs, id));
    // A knowledgebase always has a page: its connected rows alone are not one.
    if (!target || gone.size === 0 || !withPageDeleted(tabs, id)) return;
    // A connected file's row (links-and-embeds.md "Connected files in the sidebar"): Remove from Sidebar takes it
    // away at once, with no confirm, and leaves the file as it is; Undo brings it back.
    if (connectionOf(target)) {
      track('Tab', 'Deleted', 'Connected');
      commitTabs((ts) => withPageDeleted(ts, id) ?? ts);
      return;
    }
    // A locked page is protected: its writing can't be deleted, so the page that holds it can't be deleted out
    // from under it either, nor with a page above it. Unlock it first.
    const locked = tabs.find((t) => gone.has(t.id) && t.locked === true);
    if (locked) {
      toast.error(`Unlock ${toastName(locked.name) ?? 'the page'} before deleting it.`);
      return;
    }
    const subpages = subpageCount(tabs, id);
    // A saved knowledgebase keeps a Trash of pages (knowledgebases-and-pages.md "The page Trash"); an Offline one
    // has none. Either way it goes at once, and a toast offers Undo (undo-not-confirm.md).
    const toTrash = documentId !== null && !isOfflineIdSync(documentId);
    const wasActive = gone.has(activeId) ? activeId : null;
    // The step either side, decided before the commit (react-state-and-effects.md), so Undo puts back only what it
    // took.
    let step: { before: Tab[]; after: Tab[] } | null = null;
    void offerUndo({
      message: deletedPageMessage(target.name, subpages, toTrash),
      undoLabel: `Undo deleting ${target.name.trim() || 'the page'}`,
      act: () => {
        track('Tab', 'Deleted');
        // Drop the pages AND strip any links on the remaining ones that point at them, so no dangling cross-page
        // references are left. One commit, so undo restores both.
        const after = withPageAndSubpagesDeleted(tabs, id);
        step = { before: tabs, after };
        commitTabs((ts) => (ts === tabs ? after : withPageAndSubpagesDeleted(ts, id)));
        if (wasActive) {
          const fallback = pageAfterDelete(tabs, id);
          if (fallback) setActiveId(fallback);
        }
        setSelectedId(null);
        setEditingId(null);
        focus?.removed();
      },
      // The pages back in their places in the tree, and the links on other pages, unless someone changed them since.
      undo: () => {
        const taken = step;
        if (!taken) return false;
        step = null;
        commitTabs((ts) => revertStep(taken.before, taken.after, ts));
        if (wasActive) setActiveId(wasActive);
        focus?.restored();
        return true;
      },
    });
  };

  // A tree edit the tree itself checks (page-tree.ts): it answers null when it is refused or changes nothing, and
  // the list then stays as it is.
  // The moved page shows where it went: the pages it now sits under open in this reader's tree (an Indent puts it
  // under the sibling above, which may be closed).
  const editTree = (id: string, edit: (ts: Tab[]) => Tab[] | null) => {
    if (!deps.canEditStructure) return;
    const moved = edit(tabs);
    commitTabs((ts) => (ts === tabs && moved ? moved : (edit(ts) ?? ts)));
    if (moved) openParentsOf(documentId, moved, [id]);
    track('Tab', 'Reordered');
  };

  // Moves a page, its subpages with it, under `to.parent` and before its subpage `to.before`: the drag's drop.
  const movePage = (id: string, to: PageMove) => {
    const refused = pageMoveRefusal(tabs, id, to);
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return;
    }
    editTree(id, (ts) => withPageMoved(ts, id, to));
  };
  // The row menu's verbs, for keyboards and touch.
  const stepPage = (id: string, by: -1 | 1) => editTree(id, (ts) => withPageStepped(ts, id, by));
  const indentPage = (id: string) => editTree(id, (ts) => withPageIndented(ts, id));
  const outdentPage = (id: string) => editTree(id, (ts) => withPageOutdented(ts, id));

  // Reset canvas empties the tab at once, and a toast offers Undo, which puts every element back
  // (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md).
  const clearTabContent = () =>
    resetTabUndoable({
      tabId: activeId,
      tabs,
      commitTabs,
      offerUndo,
      words: RESET_TAB_WORDS.page,
      onReset: () => {
        setSelectedId(null);
        setEditingId(null);
        track('Tab', 'Cleared');
      },
    });

  return {
    addTab,
    addNamedSubpage,
    importIntoActiveTab,
    importTextIntoActiveTab,
    importFileIntoActiveTab,
    toggleActiveTabLock,
    renameTab,
    renameTabFromTitle,
    linkActiveTabTo,
    duplicateTab,
    deleteTab,
    movePage,
    stepPage,
    indentPage,
    outdentPage,
    clearTabContent,
  };
}
