'use client';

import { useRef } from 'react';
import type { Element, Tab } from '@livediagram/diagram';

// Activity-log entries from continuous interactions (a slider drag,
// a colour-picker eyedropper sweep) used to fire on every tick:
// one move of a fill-colour picker filled the panel with 30+ rows.
// This hook owns the per-key debounce slots that collapse a burst of
// calls into one entry per slot.
//
// `scheduleTabMetaLog` debounces simple text summaries (the canvas
// pattern, the canvas colour). The summary supplied to the latest
// call within the window is what lands.
//
// `scheduleElementChangeLog` debounces element-level edits via the
// emitChange diff machinery: the FIRST call inside a window captures
// the active tab's elements as the "before" snapshot, the timer
// flushes against `tabsRef.current` to get the post-debounce "after"
// (closure-captured `activeTabElements` would be stale by then).
// Keys are independent so opacity + fill-colour drags in parallel
// produce two separate entries rather than a merged one.
//
// 500 ms keeps a fast drag collapsed into one entry while still
// feeling responsive to discrete clicks: two clicks 500+ ms apart
// stay separate entries.

const ACTIVITY_LOG_DEBOUNCE_MS = 500;

type ActivityLogDebounceDeps = {
  // Emit a single element-diff entry. The diff helper inside takes
  // the before / after arrays and writes the user-friendly summary.
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
  // Emit a free-text "tab meta" entry (no element diff, no revert
  // payload). Used for theme / canvas / pattern changes.
  emitTabMeta: (tabId: string, summary: string) => void;
  // Ref to the live tabs array. Read at timer-fire time so the
  // emitted "after" snapshot reflects the post-debounce state even
  // if the user navigated to a different tab during the window.
  tabsRef: React.RefObject<Tab[]>;
  // Active tab + its current elements. Read at call time to capture
  // the "before" snapshot and to stamp the activity log entry with
  // the right tabId.
  activeId: string;
  activeTabElements: Element[];
};

type ActivityLogDebounceApi = {
  // Returns true when this call OPENED a fresh debounce window (no
  // timer was pending for the key) — the caller's cue to snapshot
  // undo history once per gesture rather than once per tick.
  scheduleTabMetaLog: (key: string, summary: string) => boolean;
  scheduleElementChangeLog: (key: string) => void;
};

export function useActivityLogDebounce(deps: ActivityLogDebounceDeps): ActivityLogDebounceApi {
  // Per-key debounce slots for tab-meta entries. Each call resets
  // the matching timer; on fire the latest summary lands.
  const tabMetaSlots = useRef<Record<string, number | undefined>>({});
  // Per-key debounce slots for element-level changes. Each slot
  // captures the pre-drag elements on the first tick of a window and
  // emits one emitChange against the post-debounce snapshot.
  const elementChangeSlots = useRef<
    Record<
      string,
      {
        before: Element[] | null;
        tabId: string | null;
        timer: number | undefined;
      }
    >
  >({});

  const scheduleTabMetaLog = (key: string, summary: string): boolean => {
    const slots = tabMetaSlots.current;
    const startedWindow = slots[key] === undefined;
    if (slots[key]) window.clearTimeout(slots[key]);
    const tabId = deps.activeId;
    slots[key] = window.setTimeout(() => {
      deps.emitTabMeta(tabId, summary);
      slots[key] = undefined;
    }, ACTIVITY_LOG_DEBOUNCE_MS);
    return startedWindow;
  };

  const scheduleElementChangeLog = (key: string) => {
    const slots = elementChangeSlots.current;
    if (!slots[key]) slots[key] = { before: null, tabId: null, timer: undefined };
    const slot = slots[key];
    if (slot.before === null) {
      slot.before = deps.activeTabElements;
      slot.tabId = deps.activeId;
    }
    if (slot.timer) window.clearTimeout(slot.timer);
    const flushTabId = slot.tabId;
    slot.timer = window.setTimeout(() => {
      const before = slot.before;
      if (before && flushTabId) {
        // tabsRef carries the post-debounce state; closure-captured
        // activeTabElements would be stale by the time the timer
        // fires (the user has been dragging this whole time).
        const tab = deps.tabsRef.current?.find((t) => t.id === flushTabId);
        if (tab) deps.emitChange(flushTabId, before, tab.elements);
      }
      slot.before = null;
      slot.tabId = null;
      slot.timer = undefined;
    }, ACTIVITY_LOG_DEBOUNCE_MS);
  };

  return { scheduleTabMetaLog, scheduleElementChangeLog };
}
