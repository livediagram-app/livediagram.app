// Tab-lifecycle actions, lifted out of editor-page.tsx: add / import /
// rename / duplicate / delete / reorder tabs, the active-tab lock,
// linking a tab into another diagram, and clearing a tab's content.
//
// This is the busiest of the extracted hooks because tab lifecycle
// genuinely touches a lot: history (`commit` / `commitTabs`), the
// activity log (`emitTabMeta`), selection state, telemetry, the
// confirm dialog + toasts, the change-log panel, and the diagram list.
// The deps object reflects that — the page still owns all that state;
// this hook only relocates the handlers verbatim so the logic lives in
// one auditable place. No behaviour change.
//
// NOT here: diagram-level lifecycle (new / open / delete / duplicate /
// move-to-folder), the template-picker flow, and the panel-accordion
// helper — those are separate concerns that stay in the page (or move
// in their own pass).

import { normalizeFolderOrder, tabFolderName, type Element, type Tab } from '@livediagram/diagram';
import { apiLinkTab, type ChangeLogEntry } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { remintElementIds, useTabImport } from './useTabImport';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import type { useToast } from '@/hooks/ui/useToast';

type TabActionsDeps = {
  tabs: Tab[];
  activeId: string;
  // The owner's diagram list — read for the destination name when
  // linking a tab into another diagram.
  diagramList: { id: string; name: string }[];
  // The local participant id (owner of the link request).
  ownerId: string;
  // Factory for a blank tab (kept in the page because the initial-state
  // initialiser also uses it).
  createTab: (name: string) => Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  emitTabMeta: (tabId: string, summary: string) => void;
  // Mark a freshly-created tab as loaded so the lazy per-tab fetch
  // (spec/13) skips it — a locally-created tab has no server row to
  // pull, so without this the canvas would flash its loading overlay
  // over the new (and never-resolving) tab.
  markTabLoaded: (id: string) => void;
  // Whether a tab's content has actually been fetched (spec/13).
  // Duplicate must refuse a still-loading source: copying the empty
  // placeholder and marking the copy loaded persists a permanently
  // empty tab.
  isTabLoaded: (id: string) => boolean;
  setActiveId: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  setGroupSourceId: (id: string | null) => void;
  // Switches the template picker into its lighter "templates" mode for
  // a freshly added tab.
  setTemplatePickerMode: (mode: 'welcome' | 'templates' | 'identity') => void;
  // Surfaces an import parse error in the header (null clears it).
  setImportError: (message: string | null) => void;
  // Drops change-log rows for a deleted tab from the visible panel.
  setChangeLog: (update: (prev: ChangeLogEntry[]) => ChangeLogEntry[]) => void;
  // Re-pulls the owner's diagram list after a cross-diagram tab link.
  refreshDiagramList: (ownerId: string) => void;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
};

export function useTabActions(deps: TabActionsDeps) {
  const {
    tabs,
    activeId,
    diagramList,
    ownerId,
    createTab,
    commit,
    commitTabs,
    emitTabMeta,
    markTabLoaded,
    isTabLoaded,
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setGroupSourceId,
    setTemplatePickerMode,
    setImportError,
    setChangeLog,
    refreshDiagramList,
    confirm,
    toast,
  } = deps;

  const addTab = () => {
    // Seed the new tab with the current tab's theme + canvas styling
    // so a user mid-diagram who hits "+ tab" doesn't lose their
    // visual context. Each tab still has its own independent
    // styling once created (changing the new tab's theme doesn't
    // affect the source). Skips when activeTab can't be resolved
    // (the hook is mid-mount or the active id points at a tab
    // that's been removed in another window), falling back to
    // brand defaults the same way Tab 1 does.
    const activeTab = tabs.find((t) => t.id === activeId);
    const seed: Partial<Tab> = activeTab
      ? {
          theme: activeTab.theme,
          backgroundPattern: activeTab.backgroundPattern,
          backgroundColor: activeTab.backgroundColor,
          backgroundOpacity: activeTab.backgroundOpacity,
          patternColor: activeTab.patternColor,
          // Carry the font + default text size too so tabs in one diagram
          // stay visually consistent instead of each reverting to default.
          // Fall back to small (spec/28) when the active tab has no explicit
          // size, so a new tab still defaults to small rather than md.
          font: activeTab.font,
          defaultTextSize: activeTab.defaultTextSize ?? 'sm',
        }
      : {};
    const tab: Tab = { ...createTab(`Tab ${tabs.length + 1}`), ...seed };
    commitTabs((ts) => [...ts, tab]);
    markTabLoaded(tab.id);
    track('Tab', 'Created');
    setActiveId(tab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
    // New tabs jump straight into the lighter template picker (just the
    // template grid). The welcome flow is first-run only, the user
    // already has an identity + theme by this point.
    setTemplatePickerMode('templates');
  };

  // Import (id re-mint, content replace, JSON / Markdown / Mermaid parsing)
  // lives in useTabImport; remintElementIds is shared with the
  // cross-diagram link below.
  const { importIntoActiveTab, importTextIntoActiveTab } = useTabImport({
    tabs,
    activeId,
    commitTabs,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setGroupSourceId,
    setImportError,
  });

  const toggleActiveTabLock = () => {
    const target = tabs.find((t) => t.id === activeId);
    if (!target) return;
    const next = !target.locked;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, locked: next } : t)));
    emitTabMeta(activeId, next ? 'Locked tab' : 'Unlocked tab');
    track('Tab', next ? 'Locked' : 'Unlocked');
    if (next) {
      // Drop any in-progress UI state that would be useless on a
      // newly-locked tab.
      setSelectedId(null);
      setEditingId(null);
      setFormatSourceId(null);
      setGroupSourceId(null);
    }
  };

  const renameTab = (id: string, name: string) => {
    const previous = tabs.find((t) => t.id === id)?.name ?? '';
    const trimmed = name.trim();
    if (trimmed === previous.trim()) return;
    commitTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
    emitTabMeta(
      id,
      previous ? `Renamed tab '${previous}' to '${trimmed}'` : `Renamed tab to '${trimmed}'`,
    );
    track('Tab', 'Renamed');
  };

  // Link the active tab into another of the user's diagrams (spec/17).
  // Goes through POST /api/diagrams/<target>/tabs/<tabId>/link so the
  // server inserts one `diagram_tabs` row pointing at the existing
  // tab body. The previous implementation cloned the tab into a fresh
  // row with a new id; that duplicated the content (edits on either
  // side stayed siloed) and the menu label promised the linking
  // behaviour the user actually wanted. After this call, edits to
  // the tab from either diagram write to the same `tabs.data` row.
  const linkActiveTabTo = async (targetDiagramId: string) => {
    const source = tabs.find((t) => t.id === activeId);
    if (!source) return;
    const targetName = diagramList.find((d) => d.id === targetDiagramId)?.name ?? 'that diagram';
    try {
      await apiLinkTab(ownerId, targetDiagramId, source.id);
      toast.success(`Tab added to "${targetName}"`);
      track('Tab', 'Linked');
    } catch {
      // Previously swallowed silently: the user clicked a destination
      // and nothing visible happened. The toast surfaces the failure
      // without forcing a modal; refresh still runs so the source
      // diagram's local state remains consistent with what landed.
      toast.error(`Could not add tab to "${targetName}". Try again.`);
    }
    refreshDiagramList(ownerId);
  };

  const duplicateTab = (id: string) => {
    const src = tabs.find((t) => t.id === id);
    if (!src) return;
    // A still-loading source is an empty placeholder — copying it (and
    // marking the copy loaded below) would persist a permanently empty
    // tab. The lazy fetch resolves in well under a second; asking the
    // user to retry beats silently duplicating nothing.
    if (!isTabLoaded(id)) {
      toast.error('That tab is still loading — try again in a moment.');
      return;
    }
    const copy: Tab = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      // Re-mint ids (arrow endpoints remapped): element ids must be
      // unique per DIAGRAM, not just per tab — verbatim copies made a
      // peer's selection of the original render (and lock, spec/07) on
      // the copy too, since remote selections resolve by element id.
      elements: remintElementIds(src.elements.map((el) => ({ ...el }))),
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

  // Confirmation is handled by the inline ConfirmPopover anchored to the
  // tab menu's Delete row (TabBar), so this just performs the delete. The
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
            // gone tab. Diagram + url links target somewhere else
            // entirely, so they survive; only tab / element links carry
            // a tabId to check.
            if (el.link.kind !== 'tab' && el.link.kind !== 'element') return el;
            if (el.link.tabId !== id) return el;
            const { link: _drop, ...rest } = el;
            return rest as typeof el;
          }),
        })),
    );
    // Local cascade: drop audit-log entries for the gone tab from the
    // visible panel immediately. The server-side cascade lives inside
    // deleteTabRow (apps/api/src/db.ts): it only drops the change_log
    // rows when the underlying `tabs` row is itself dropped, so a
    // shared tab unlinked from this diagram keeps its history in any
    // diagram that still surfaces it (per spec/17). The previous
    // client-side apiDeleteChangeLogForTab call wiped the log
    // globally, which silently broke the audit panel for every other
    // diagram sharing the tab.
    setChangeLog((prev) => prev.filter((entry) => entry.tabId !== id));
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
    // A drag ADOPTS the drop target's folder membership (spec/30): dropping
    // a tab among a folder's pills joins that folder, dropping it among
    // loose tabs makes it loose, and dropping onto the folder chip (which
    // targets the run's first member) joins too. So one drag both reorders
    // AND moves the tab in / out of a folder. (Closure values drive the
    // telemetry / activity log below; the mutation itself recomputes from
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
      // Re-normalize so every folder stays one contiguous run (spec/30).
      return normalizeFolderOrder(next);
    });
    if (srcFolder !== targetFolder && targetFolder) {
      emitTabMeta(sourceId, `Moved tab to folder '${targetFolder}'`);
      track('Tab', 'Moved');
    } else if (srcFolder !== targetFolder) {
      emitTabMeta(sourceId, `Removed tab from folder '${srcFolder}'`);
      track('Tab', 'Reordered');
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
      title: 'Reset this canvas?',
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
    toggleActiveTabLock,
    renameTab,
    linkActiveTabTo,
    duplicateTab,
    deleteTab,
    reorderTabs,
    clearTabContent,
  };
}
