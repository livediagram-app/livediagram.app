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

import { type Element, type Tab } from '@livediagram/diagram';
import { apiLinkTab, type ChangeLogEntry } from '@/lib/api-client';
import { parseImportedTab, pickTabFile } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/useConfirm';
import type { useToast } from '@/hooks/useToast';

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
    const tab = createTab(`Tab ${tabs.length + 1}`);
    commitTabs((ts) => [...ts, tab]);
    track('Tab', 'Created');
    setActiveId(tab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
    // New tabs jump straight into the lighter template picker (just the
    // template grid). The welcome flow is first-run only — the user
    // already has an identity + theme by this point.
    setTemplatePickerMode('templates');
  };

  // Import a tab from a `.livediagram-tab.json` file the user picks.
  // Tab id + nested element ids are re-minted client-side so the
  // imported tab can never collide with an existing one. Schema
  // mismatches surface via setImportError which the header button
  // renders in-place.
  const importTabFromFile = async () => {
    const text = await pickTabFile();
    if (!text) return;
    const result = parseImportedTab(text);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    // Re-mint ids so the imported tab can't collide. Pinned arrows
    // need their element references rewritten to the new ids — walk
    // boxed elements first, build an old→new id map, then rewrite
    // arrow endpoints.
    const idMap = new Map<string, string>();
    const newElements = result.tab.elements.map((el) => {
      const newId = crypto.randomUUID();
      idMap.set(el.id, newId);
      return { ...el, id: newId };
    });
    for (const el of newElements) {
      if (el.type === 'arrow') {
        if (el.from.kind === 'pinned') {
          const mapped = idMap.get(el.from.elementId);
          if (mapped) el.from = { ...el.from, elementId: mapped };
        }
        if (el.to.kind === 'pinned') {
          const mapped = idMap.get(el.to.elementId);
          if (mapped) el.to = { ...el.to, elementId: mapped };
        }
      }
    }
    const newTab: Tab = {
      ...result.tab,
      id: crypto.randomUUID(),
      elements: newElements,
    };
    commitTabs((ts) => [...ts, newTab]);
    setActiveId(newTab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

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
    const copy: Tab = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      elements: src.elements.map((el) => ({ ...el })),
    };
    const srcIndex = tabs.findIndex((t) => t.id === id);
    commitTabs((ts) => {
      const next = [...ts];
      next.splice(srcIndex + 1, 0, copy);
      return next;
    });
    setActiveId(copy.id);
    setSelectedId(null);
    setEditingId(null);
    track('Tab', 'Duplicated');
  };

  const deleteTab = async (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const target = tabs[idx]!;
    const ok = await confirm({
      title: `Delete tab "${target.name || 'Untitled'}"?`,
      message:
        "The tab's elements and its activity log entries are removed. Links on other tabs pointing here are stripped. Undo restores everything.",
      confirmLabel: 'Delete tab',
    });
    if (!ok) return;
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
            // Tab-level deletion cleans up links pointing at the
            // gone tab. Diagram-kind links survive (they target
            // another diagram entirely, unrelated to this tab).
            if (el.link.kind === 'diagram' || el.link.tabId !== id) return el;
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

  const reorderTabs = (sourceId: string, targetId: string) => {
    commitTabs((ts) => {
      const srcIdx = ts.findIndex((t) => t.id === sourceId);
      const tgtIdx = ts.findIndex((t) => t.id === targetId);
      if (srcIdx < 0 || tgtIdx < 0 || srcIdx === tgtIdx) return ts;
      const next = [...ts];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved!);
      return next;
    });
  };

  const clearTabContent = () => {
    commit(() => []);
    setSelectedId(null);
    setEditingId(null);
  };

  return {
    addTab,
    importTabFromFile,
    toggleActiveTabLock,
    renameTab,
    linkActiveTabTo,
    duplicateTab,
    deleteTab,
    reorderTabs,
    clearTabContent,
  };
}
