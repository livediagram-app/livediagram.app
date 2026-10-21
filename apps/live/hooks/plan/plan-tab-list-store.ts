'use client';

// The document's Board, Sheet and Diagram tabs, for a Dashboard's palette (docs/specs/026-plan/plan-tabs.md "The Tabs
// category"): its Tabs category offers each as a tile that shows the tab in a slot. A module store, like
// plan-cover-store.ts, published by usePlanCoverWiring; listeners hear only a real change (a tab added, removed,
// renamed or turned), never an element moved.
import { useSyncExternalStore } from 'react';
import { tabKindOf, type DashboardTabOf, type Tab } from '@liveplanner/document';
import { createListeners } from '@/lib/listeners';

export type PlanTabEntry = { id: string; name: string; of: DashboardTabOf };

const EMPTY: readonly PlanTabEntry[] = [];
let list: readonly PlanTabEntry[] = EMPTY;
const listeners = createListeners();

// The Board, Sheet and Diagram tabs of `tabs` (every tab but a Dashboard: a diagram shows
// as a Diagram), in tab-bar order.
export function planTabEntries(tabs: readonly Tab[]): PlanTabEntry[] {
  return tabs.flatMap((t): PlanTabEntry[] => {
    const kind = tabKindOf(t);
    // A Form tab is a page of its own, never a slot's (docs/specs/030-forms/forms.md).
    if (kind === 'dashboard' || kind === 'form') return [];
    return [
      { id: t.id, name: t.name, of: kind === 'board' || kind === 'sheet' ? kind : 'diagram' },
    ];
  });
}

const keyOf = (l: readonly PlanTabEntry[]) => l.map((e) => `${e.of}:${e.id}:${e.name}`).join('\n');

export function setPlanTabList(next: readonly PlanTabEntry[]): void {
  if (keyOf(next) === keyOf(list)) return;
  list = next.length ? next : EMPTY;
  listeners.notify();
}

const read = () => list;
const serverEmpty = () => EMPTY;
export function usePlanTabList(): readonly PlanTabEntry[] {
  return useSyncExternalStore(listeners.subscribe, read, serverEmpty);
}
