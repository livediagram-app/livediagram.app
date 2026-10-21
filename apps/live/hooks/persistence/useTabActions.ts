// Tab-lifecycle actions, lifted out of editor-page.tsx: add / import /
// rename / duplicate / delete / reorder tabs, the active-tab lock,
// linking a tab into another document, and clearing a tab's content.
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

import { defaultTabName, isDefaultTabName } from '@liveplanner/document';
import { boardsRenamedWithTab, planTitledWithTab, sheetIdsOn } from '@/lib/tab-named-plan';
import { withFormHeading } from '@/lib/form-tab';
import type { ImportedPlanItems } from '@/lib/import-tab';
import type { PlanTabImportResult } from '@/hooks/plan/usePlanTabImport';
import {
  normalizeFolderOrder,
  tabFolderName,
  truncateName,
  type Element,
  type Tab,
} from '@liveplanner/document';
import { apiLinkTab } from '@/lib/api-client';
import { newTabSeed } from '@/lib/new-tab-seed';
import { track } from '@/lib/telemetry';
import { useBoardSceneImport } from './useBoardSceneImport';
import { remintTabElements, useTabImport } from './useTabImport';
import { trackTabFolderTransition } from './tab-folder-reporting';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import type { useToast } from '@/hooks/ui/useToast';
import { toastName } from '@/lib/toast-name';

type TabActionsDeps = {
  tabs: Tab[];
  activeId: string;
  // Whether the session may change the document's structure (its tabs): false for a view link and
  // for any tab-scoped link (docs/specs/013-workspace/tab-scoped-share-links.md).
  canEditStructure: boolean;
  // The owner's document list — read for the destination name when
  // linking a tab into another document.
  documentList: { id: string; name: string }[];
  // The local participant id (owner of the link request, and of any
  // images an import stores).
  ownerId: string;
  // The open document: an Offline Mode one embeds imported images.
  documentId: string | null;
  // Factory for a blank tab (kept in the page because the initial-state
  // initialiser also uses it).
  createTab: (name: string) => Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
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
  // Re-pulls the owner's document list after a cross-document tab link.
  refreshDocumentList: (ownerId: string) => void;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
  // A JSON tab export's Plan items, added after its tab lands (usePlanTabImport).
  importPlanItems: (plan: ImportedPlanItems) => Promise<PlanTabImportResult>;
  // A tab renamed away from its default name: its Sheets still named that follow it (lib/tab-named-plan.ts).
  retitleSheets?: (sheetIds: readonly string[], from: string, to: string) => void;
  // A Sheet's title as it is now (a Sheet tab's follows the tab whatever it was).
  sheetTitle?: (sheetId: string) => string | undefined;
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
    markTabLoaded,
    isTabLoaded,
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    requestFit,
    refreshDocumentList,
    confirm,
    toast,
  } = deps;

  // A new tab opens on Start Planning (docs/specs/026-plan/plan-tabs.md).
  const addTab = () => {
    // A session that cannot change the document's tabs adds none, whichever control asked.
    if (!deps.canEditStructure) return;
    // The new tab takes the active tab's look (newTabSeed).
    // Skips the look when the active tab can't be resolved (mid-mount, or removed in another
    // window), falling back to brand defaults the same way Tab 1 does.
    const seed = newTabSeed(tabs.find((t) => t.id === activeId));
    const tab: Tab = { ...createTab(defaultTabName(tabs.length + 1)), ...seed };
    commitTabs((ts) => [...ts, tab]);
    markTabLoaded(tab.id);
    track('Tab', 'Created');
    setActiveId(tab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
  };

  // Import (id re-mint, content replace, JSON / Markdown / Mermaid parsing)
  // lives in useTabImport; remintTabElements is shared with the
  // Duplicate below.
  const { importIntoActiveTab, importTextIntoActiveTab, replaceActiveTabContent } = useTabImport({
    tabs,
    createTab,
    markTabLoaded,
    ownerId,
    documentId,
    activeId,
    commitTabs,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    requestFit,
    // Declared below; called only once an import runs, after this render has defined it.
    importScene: (scene, onProgress) => importSceneIntoActiveTab(scene, onProgress),
    importPlanItems: deps.importPlanItems,
  });
  // Board scenes from other tools (docs/specs/020-import-export/board-scene.md): replace the
  // active tab, or open each board as a new whiteboard tab.
  const { importSceneIntoActiveTab, importScenesAsNewDocuments } = useBoardSceneImport({
    tabs,
    activeId,
    ownerId,
    documentId,
    replaceActiveTabContent,
    onDocumentsCreated: () => refreshDocumentList(ownerId),
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

  const renameTab = (id: string, name: string) => {
    const previous = tabs.find((t) => t.id === id)?.name ?? '';
    // Capped here rather than at each input, so every route in (the tab
    // pill's inline rename, the command palette, an import) lands under the
    // same limit (docs/specs/006-document/name-length.md).
    const trimmed = truncateName(name);
    if (trimmed === previous.trim()) return;
    // Its boards and Sheets still named after its default name follow it (docs/specs/026-plan/plan-board.md
    // "The board set-up"): the boards in the same commit, so one undo takes both back. A Board or Sheet tab and its
    // board or Sheet are one thing (docs/specs/026-plan/plan-tabs.md): theirs follow it whatever they were called.
    const target = tabs.find((t) => t.id === id);
    const kindTab = target?.kind === 'board' || target?.kind === 'sheet';
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              // A Form tab's form takes the name as its heading (docs/specs/030-forms/forms.md "The Form tab").
              ...withFormHeading(t, trimmed),
              name: trimmed,
              elements:
                planTitledWithTab(t, trimmed) ??
                boardsRenamedWithTab(t.elements, previous, trimmed),
            }
          : t,
      ),
    );
    const sheetIds = sheetIdsOn(target?.elements ?? []);
    if (kindTab) {
      for (const sheetId of sheetIds) {
        const now = deps.sheetTitle?.(sheetId);
        if (now !== undefined) deps.retitleSheets?.([sheetId], now, trimmed);
      }
    } else if (isDefaultTabName(previous) && sheetIds.length > 0) {
      deps.retitleSheets?.(sheetIds, previous.trim(), trimmed);
    }
    track('Tab', 'Renamed');
  };

  // Link the active tab into another of the user's documents (docs/specs/006-document/tab-document-many-to-many.md).
  // Goes through POST /api/documents/<target>/tabs/<tabId>/link so the
  // server inserts one `document_tabs` row pointing at the existing
  // tab body. The previous implementation cloned the tab into a fresh
  // row with a new id; that duplicated the content (edits on either
  // side stayed siloed) and the menu label promised the linking
  // behaviour the user actually wanted. After this call, edits to
  // the tab from either document write to the same `tabs.data` row.
  const linkActiveTabTo = async (targetDocumentId: string) => {
    const source = tabs.find((t) => t.id === activeId);
    if (!source) return;
    const target =
      toastName(documentList.find((d) => d.id === targetDocumentId)?.name) ?? 'that document';
    try {
      await apiLinkTab(ownerId, targetDocumentId, source.id);
      toast.success(`${toastName(source.name) ?? 'Tab'} added to ${target}`);
      track('Tab', 'Linked');
    } catch {
      // Previously swallowed silently: the user clicked a destination
      // and nothing visible happened. The toast surfaces the failure
      // without forcing a modal; refresh still runs so the source
      // document's local state remains consistent with what landed.
      // Two names fill the line, so the try-again is left to the reader.
      toast.error(`Could not add ${toastName(source.name) ?? 'the tab'} to ${target}.`);
    }
    refreshDocumentList(ownerId);
  };

  const duplicateTab = (id: string) => {
    const src = tabs.find((t) => t.id === id);
    if (!src) return;
    // A still-loading source is an empty placeholder — copying it (and
    // marking the copy loaded below) would persist a permanently empty
    // tab. The lazy fetch resolves in well under a second; asking the
    // user to retry beats silently duplicating nothing.
    if (!isTabLoaded(id)) {
      toast.error('That tab is still loading. Try again in a moment.');
      return;
    }
    // Re-mint ids (arrow endpoints remapped): element ids must be
    // unique per DOCUMENT, not just per tab — verbatim copies made a
    // peer's selection of the original render (and lock, docs/specs/007-editor/live-app.md) on
    // the copy too, since remote selections resolve by element id. A Dashboard's slots follow the new ids.
    const reminted = remintTabElements({ ...src, elements: src.elements.map((el) => ({ ...el })) });
    const name = `${src.name} copy`;
    // A Board or Visualisation tab and its board or chart share one name (docs/specs/026-plan/plan-tabs.md "Names"):
    // the copy's are titled as the copy is, so neither takes the original's name back later.
    const copy: Tab = {
      // A copied Form tab is never published (its link lives on the server) and is headed as the copy is named.
      ...withFormHeading(reminted, name),
      elements: planTitledWithTab(reminted, name) ?? reminted.elements,
      id: crypto.randomUUID(),
      name,
    };
    const srcIndex = tabs.findIndex((t) => t.id === id);
    commitTabs((ts) => {
      const next = [...ts];
      next.splice(srcIndex + 1, 0, copy);
      return next;
    });
    markTabLoaded(copy.id);
    setActiveId(copy.id);
    setSelectedId(null);
    setEditingId(null);
    track('Tab', 'Duplicated');
  };

  // Asks nothing: one commit, so undo brings the tab back (the tab menu asks first only when deleting does what an
  // undo cannot take back, deleteTabWarning). The
  // menu's Delete item is already gated on `canDelete` (tabs.length > 1);
  // the guards here are belt-and-suspenders.
  const deleteTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    // A locked tab is protected: its elements can't be deleted, so the
    // tab that holds them can't be deleted out from under them either.
    // Unlock it first. (The TabBar also gates the Delete row on this.)
    if (tabs[idx]?.locked === true) return;
    track('Tab', 'Deleted');
    // Drop the tab AND strip any links on remaining elements that point to
    // it, so we don't leave dangling cross-tab references. Bundled into one
    // commit so undo restores both.
    commitTabs((ts) =>
      ts
        .filter((t) => t.id !== id)
        .map((t) => ({
          ...t,
          elements: t.elements.map((el) => {
            if (!el.link) return el;
            // Tab-level deletion only cleans up links pointing AT the
            // gone tab. Document + url links target somewhere else
            // entirely, so they survive; only tab / element links carry
            // a tabId to check.
            if (el.link.kind !== 'tab' && el.link.kind !== 'element') return el;
            if (el.link.tabId !== id) return el;
            const { link: _drop, ...rest } = el;
            return rest;
          }),
        })),
    );
    if (activeId === id) {
      const fallback = tabs[idx + 1] ?? tabs[idx - 1];
      if (fallback) setActiveId(fallback.id);
    }
    setSelectedId(null);
    setEditingId(null);
  };

  const reorderTabs = (sourceId: string, targetId: string, placeBefore = true) => {
    if (sourceId === targetId) return;
    const srcIdx0 = tabs.findIndex((t) => t.id === sourceId);
    const tgtIdx0 = tabs.findIndex((t) => t.id === targetId);
    if (srcIdx0 < 0 || tgtIdx0 < 0) return;
    // A drag ADOPTS the drop target's folder membership (docs/specs/006-document/tab-folders.md): dropping
    // a tab among a folder's pills joins that folder, dropping it among
    // loose tabs makes it loose, and dropping onto the folder chip (which
    // targets the run's first member) joins too. So one drag both reorders
    // AND moves the tab in / out of a folder. (Closure values drive the
    // telemetry below; the mutation itself recomputes from
    // live state inside the commit.)
    const srcFolder = tabFolderName(tabs[srcIdx0]!);
    const targetFolder = tabFolderName(tabs[tgtIdx0]!);
    commitTabs((ts) => {
      const sIdx = ts.findIndex((t) => t.id === sourceId);
      const tIdx = ts.findIndex((t) => t.id === targetId);
      if (sIdx < 0 || tIdx < 0) return ts;
      const folder = tabFolderName(ts[tIdx]!);
      const next = [...ts];
      const [moved] = next.splice(sIdx, 1);
      // Recompute the target's index AFTER removing the source (removing an
      // earlier source shifts the target left by one), then land before or
      // after it per `placeBefore`. This makes the drop deterministic: the
      // caret the user saw is exactly where the tab goes, regardless of drag
      // direction.
      const insertBase = next.findIndex((t) => t.id === targetId);
      const insertIdx = placeBefore ? insertBase : insertBase + 1;
      next.splice(insertIdx, 0, { ...moved!, folder: folder ?? undefined });
      // Re-normalize so every folder stays one contiguous run (docs/specs/006-document/tab-folders.md).
      return normalizeFolderOrder(next);
    });
    // A drag that crosses a folder boundary reports the membership change, not
    // the reorder that came with it — and reports it through the same module the
    // ellipsis menu uses, so the two controls can't drift again. (Leaving a
    // folder by drag used to count as `Tab·Reordered` while the menu counted it
    // as `Tab·Removed`, which made "how do people manage tab folders?"
    // unanswerable from the numbers.)
    if (srcFolder !== targetFolder) {
      trackTabFolderTransition(srcFolder, targetFolder);
    } else {
      track('Tab', 'Reordered');
    }
  };

  const clearTabContent = async () => {
    // Wiping a whole tab is a big, easy-to-misfire action, so gate it on
    // the branded confirm dialog (same as deleting a tab) rather than
    // clearing the instant the menu item is clicked. It IS undoable
    // (one commit), which the message notes.
    const ok = await confirm({
      title: 'Reset This Canvas?',
      message: 'Every element on this tab is removed. Undo (Cmd/Ctrl-Z) brings it back.',
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
    importIntoActiveTab,
    importTextIntoActiveTab,
    importSceneIntoActiveTab,
    importScenesAsNewDocuments,
    toggleActiveTabLock,
    renameTab,
    linkActiveTabTo,
    duplicateTab,
    deleteTab,
    reorderTabs,
    clearTabContent,
  };
}
