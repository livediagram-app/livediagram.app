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

import { useEffect, useRef } from 'react';
import {
  NEW_PAGE_NAME,
  pageAddRefusal,
  pageMoveRefusal,
  pageSubtreeIds,
  subpageCount,
  truncateName,
  withPageIndented,
  withPageMoved,
  withPageOutdented,
  withPageStepped,
  type Element,
  type PageMove,
  type Tab,
} from '@liveknowledge/document';
import { withPageTitle } from '@/lib/article/page-title';
import { wantTitleFocus } from '@/lib/page-title-focus';
import {
  deletePageTitle,
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
import { remintTabElements, useTabImport } from './useTabImport';
import type { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
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
  commit: (mapElements: (els: Element[]) => Element[]) => void;
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
  confirm: ReturnType<typeof useConfirm>;
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
    commit,
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
    confirm,
    toast,
  } = deps;

  // A new page, the last subpage of `parent` or the last top-level page. It opens with the caret in its Title
  // (wantTitleFocus, answered by usePageTitleFocus once the page's writing is on screen).
  const addTab = (parent?: string) => {
    // A session that cannot change the knowledgebase's pages adds none, whichever control asked.
    if (!deps.canEditStructure) return;
    // At a limit the controls are disabled with the reason; a shortcut or the command palette hears it here.
    const refused = pageAddRefusal(tabs, parent);
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
    const refused = pageAddRefusal(tabs, parent);
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return null;
    }
    const title = truncateName(name) || NEW_PAGE_NAME;
    const seed = newTabSeed(tabs.find((t) => t.id === activeId));
    const tab: Tab = withPageTitle({ ...createTab(title), ...seed }, title);
    commitTabs((ts) => withPageAddedTo(ts, tab, parent));
    markTabLoaded(tab.id);
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
  // undo step of its own, so undoing the typing is one step.
  const renameTabFromTitle = (id: string, title: string) => {
    if (!deps.canEditStructure) return;
    const trimmed = truncateName(title);
    const tab = tabs.find((t) => t.id === id);
    if (!trimmed || !tab || tab.name === trimmed || tab.locked === true) return;
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
    const refused = pageAddRefusal(tabs, src.parent);
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return;
    }
    // A still-loading source is an empty placeholder — copying it (and
    // marking the copy loaded below) would persist a permanently empty
    // page. The lazy fetch resolves in well under a second; asking the
    // user to retry beats silently duplicating nothing.
    if (!isTabLoaded(id)) {
      toast.error('That page is still loading. Try again in a moment.');
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

  // Deletes a page and its subpages after one confirmation that names the count. One commit, so undo brings them
  // all back. The row menu's Delete is already disabled on the last page and on a locked one; the guards here are
  // belt-and-suspenders.
  const deleteTab = async (id: string) => {
    if (!deps.canEditStructure) return;
    const target = tabs.find((t) => t.id === id);
    const gone = new Set(pageSubtreeIds(tabs, id));
    // A knowledgebase always has a page.
    if (!target || gone.size === 0 || gone.size >= tabs.length) return;
    // A locked page is protected: its writing can't be deleted, so the page that holds it can't be deleted out
    // from under it either, nor with a page above it. Unlock it first.
    if (tabs.some((t) => gone.has(t.id) && t.locked === true)) {
      toast.error('Unlock the page before deleting it.');
      return;
    }
    const subpages = subpageCount(tabs, id);
    const ok = await confirm({
      title: deletePageTitle(target.name, subpages),
      message:
        subpages === 0
          ? 'The page is removed for everyone. Undo (Cmd/Ctrl-Z) brings it back.'
          : 'The page and its subpages are removed for everyone. Undo (Cmd/Ctrl-Z) brings them back.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    track('Tab', 'Deleted');
    // Drop the pages AND strip any links on the remaining ones that point at them, so no dangling cross-page
    // references are left. One commit, so undo restores both.
    commitTabs((ts) => withPageAndSubpagesDeleted(ts, id));
    if (gone.has(activeId)) {
      const fallback = pageAfterDelete(tabs, id);
      if (fallback) setActiveId(fallback);
    }
    setSelectedId(null);
    setEditingId(null);
  };

  // A tree edit the tree itself checks (page-tree.ts): it answers null when it is refused or changes nothing, and
  // the list then stays as it is.
  const editTree = (edit: (ts: Tab[]) => Tab[] | null) => {
    if (!deps.canEditStructure) return;
    commitTabs((ts) => edit(ts) ?? ts);
    track('Tab', 'Reordered');
  };

  // Moves a page, its subpages with it, under `to.parent` and before its subpage `to.before`: the drag's drop.
  const movePage = (id: string, to: PageMove) => {
    const refused = pageMoveRefusal(tabs, id, to);
    if (refused) {
      toast.error(pageTreeRefusalText(refused));
      return;
    }
    editTree((ts) => withPageMoved(ts, id, to));
  };
  // The row menu's verbs, for keyboards and touch.
  const stepPage = (id: string, by: -1 | 1) => editTree((ts) => withPageStepped(ts, id, by));
  const indentPage = (id: string) => editTree((ts) => withPageIndented(ts, id));
  const outdentPage = (id: string) => editTree((ts) => withPageOutdented(ts, id));

  const clearTabContent = async () => {
    // Wiping a whole tab is a big, easy-to-misfire action, so gate it on
    // the branded confirm dialog (same as deleting a tab) rather than
    // clearing the instant the menu item is clicked. It IS undoable
    // (one commit), which the message notes.
    const ok = await confirm({
      title: 'Reset This Canvas?',
      message: 'Everything on this page is removed. Undo (Cmd/Ctrl-Z) brings it back.',
      confirmLabel: 'Reset canvas',
    });
    if (!ok) return;
    commit(() => []);
    setSelectedId(null);
    setEditingId(null);
    track('Tab', 'Cleared');
  };

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
