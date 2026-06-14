import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { Element, Tab } from '@livediagram/diagram';
import { CHANGE_LOG_LIST_LIMIT } from '@livediagram/api-schema';
import {
  apiAppendChangeLogEntry,
  apiDeleteChangeLogEntry,
  apiDeleteChangeLogForTab,
  connectRoom,
  type ChangeLogEntry,
} from '@/lib/api-client';
import { applyRevert } from '@/lib/change-log';
import { track } from '@/lib/telemetry';
import { HISTORY_LIMIT } from '@/hooks/useDiagramHistory';
import type { TabAccordionState } from '@/components/CommandPalette';
import { patchTab } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Activity log + undo/redo handlers, lifted out of editor-page.tsx. The
// log and the history stacks move together: undo drops the matching
// entry (local + D1 + room broadcast), redo re-inserts it. Revert
// replays an entry's `before` payload onto its tab. All verbatim; the
// ~20 state slices they touch are passed as grouped set/refs bundles.
export function useEditorHistory(opts: {
  activeId: string;
  diagramId: string | null;
  selfId: string;
  sessionShareCode: string | null;
  tabs: Tab[];
  editsBlocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  requestEditorOpen: () => void;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  tickTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  undoHistory: () => void;
  redoHistory: () => void;
  refs: {
    roomRef: RefObject<ReturnType<typeof connectRoom> | null>;
    entryHistoryRef: MutableRefObject<{ past: ChangeLogEntry[]; future: ChangeLogEntry[] }>;
  };
  set: {
    setActiveId: SetState<string>;
    setSelectedId: SetState<string | null>;
    setMultiSelectedIds: SetState<Set<string>>;
    setEditingId: SetState<string | null>;
    setTabAccordionsOpen: SetState<TabAccordionState>;
    setChangeLog: SetState<ChangeLogEntry[]>;
    setFormatSourceId: SetState<string | null>;
    setGroupSourceId: SetState<string | null>;
  };
}) {
  const {
    activeId,
    diagramId,
    selfId,
    sessionShareCode,
    tabs,
    editsBlocked,
    canUndo,
    canRedo,
    requestEditorOpen,
    commitTabs,
    tickTabs,
    undoHistory,
    redoHistory,
    refs,
    set,
  } = opts;
  const { roomRef, entryHistoryRef } = refs;
  const {
    setActiveId,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    setChangeLog,
    setFormatSourceId,
    setGroupSourceId,
  } = set;

  const handleActivityRowClick = (entry: ChangeLogEntry) => {
    // Switch to the entry's tab if we're not already on it. Without
    // this, selecting an element on a different tab would silently
    // fail because tabs[].find(t=>t.id===entry.tabId) is the wrong
    // active tab.
    if (entry.tabId && entry.tabId !== activeId) {
      setActiveId(entry.tabId);
    }
    if (entry.elementIds.length > 0) {
      // Element entry — select the (first) affected element and
      // clear any marquee multi-selection. The selection popover
      // takes care of itself from there.
      const target = entry.elementIds[0]!;
      setSelectedId(target);
      setMultiSelectedIds(new Set());
      setEditingId(null);
      return;
    }
    // Tab-meta entries (theme / background tweaks) have no element ids.
    // Theme + Canvas now live in the Tab Appearance modal rather than the
    // tab-editor accordions, so there's no accordion to expand here; just
    // clear any selection and surface the editor panel.
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    requestEditorOpen();
  };

  // Drop every audit entry for the currently active tab. The diagram
  // itself is untouched — only the log dies. The Activity Panel
  // exposes this via its bottom "Clear Activity" button. Mirrors the
  // server-side cascade that runs on tab delete, just user-triggered.
  const clearActivityForActiveTab = () => {
    if (!diagramId) return;
    const targetTabId = activeId;
    setChangeLog((prev) => prev.filter((entry) => entry.tabId !== targetTabId));
    apiDeleteChangeLogForTab(selfId, diagramId, targetTabId, sessionShareCode).catch(() => {
      // Best-effort. Stale rows in D1 are harmless; the next list
      // fetch reconciles. We don't want a transient error to block
      // the local clear that already happened.
    });
  };

  // Surgical revert: replay the entry's `before` payload onto the
  // target tab. Other elements (including newer edits) are untouched.
  // If the tab was deleted in between, the revert is a no-op — the
  // log entry has already been cascade-dropped.
  //
  // The reverted entry is removed from the log rather than getting a
  // 'reverted' twin appended. Keeps the panel compact: a revert is a
  // cancellation of an event, not its own event.
  const revertChange = (entry: ChangeLogEntry) => {
    const tabId = entry.tabId;
    if (!tabId) return;
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    const after = applyRevert(target.elements, entry.beforeState as Record<string, Element | null>);
    commitTabs((ts) => patchTab(ts, tabId, { elements: after }));
    if (tabId !== activeId) setActiveId(tabId);
    track('Diagram', 'Reverted');
    // Drop the entry locally first so the panel updates immediately;
    // fire-and-forget the API delete.
    setChangeLog((prev) => prev.filter((e) => e.id !== entry.id));
    if (diagramId) {
      apiDeleteChangeLogEntry(selfId, diagramId, entry.id, sessionShareCode).catch(() => {
        // Best-effort. A stale row in D1 surfaces on the next list
        // fetch — at which point the entry would reappear; acceptable
        // tradeoff for the lighter UX.
      });
    }
    roomRef.current?.send({ kind: 'op', op: { kind: 'log-remove', entryId: entry.id } });
  };

  const tick = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    tickTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  // Undo / redo are paired with the activity log: undoing a step
  // removes the matching entry from the panel (and from D1), redoing
  // re-inserts the same entry verbatim. The `canUndo` / `canRedo`
  // guards keep this in sync with useDiagramHistory's bounded stacks
  // — if the history is exhausted, our entry stacks stay put.
  const undo = () => {
    if (!canUndo) return;
    track('Diagram', 'Undone');
    undoHistory();
    const { past, future } = entryHistoryRef.current;
    const popped = past[past.length - 1];
    if (popped) {
      entryHistoryRef.current = {
        past: past.slice(0, -1),
        future: [popped, ...future].slice(0, HISTORY_LIMIT),
      };
      setChangeLog((prev) => prev.filter((e) => e.id !== popped.id));
      if (diagramId) {
        apiDeleteChangeLogEntry(selfId, diagramId, popped.id, sessionShareCode).catch(() => {
          // Best-effort. A redo will re-POST the same id so a stale
          // duplicate is unlikely.
        });
      }
      roomRef.current?.send({ kind: 'op', op: { kind: 'log-remove', entryId: popped.id } });
    }
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  const redo = () => {
    if (!canRedo) return;
    track('Diagram', 'Redone');
    redoHistory();
    const { past, future } = entryHistoryRef.current;
    const next = future[0];
    if (next) {
      entryHistoryRef.current = {
        past: [...past, next].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      };
      setChangeLog((prev) => [next, ...prev].slice(0, CHANGE_LOG_LIST_LIMIT));
      if (diagramId) {
        // Same entry id and content — D1 ends up with the same row
        // it had before the undo. Idempotent under network retries
        // (the API treats POST as insert; a re-insert of the same id
        // would fail loudly but we don't double-fire).
        apiAppendChangeLogEntry(selfId, diagramId, next, sessionShareCode).catch(() => {});
      }
      roomRef.current?.send({ kind: 'op', op: { kind: 'log', entry: next } });
    }
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  return { handleActivityRowClick, clearActivityForActiveTab, revertChange, tick, undo, redo };
}
