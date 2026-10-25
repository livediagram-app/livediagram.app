'use client';

// The project's Board and Sheet tabs, for a Dashboard's palette (docs/specs/026-plan/plan-tabs.md "The Tabs
// category"): its Tabs category offers each as a tile that shows the tab in a slot. A module store, like
// plan-cover-store.ts, published by usePlanCoverWiring; listeners hear only a real change (a tab added, removed,
// renamed or turned), never an element moved.
import { useSyncExternalStore } from 'react';
import { tabKindOf, type DashboardTabOf, type Tab } from '@liveplanner/project';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

export type PlanTabEntry = { id: string; name: string; of: DashboardTabOf };

const EMPTY: readonly PlanTabEntry[] = [];
let list: readonly PlanTabEntry[] = EMPTY;
const listeners = createListeners();

// The Board and Sheet tabs of `tabs`, in tab-bar order: a Dashboard, a Form (a page of its own,
// docs/specs/030-forms/forms.md) and a tab still on Start Planning never go in a slot.
export function planTabEntries(tabs: readonly Tab[]): PlanTabEntry[] {
  return tabs.flatMap((t): PlanTabEntry[] => {
    const kind = tabKindOf(t);
    return kind === 'board' || kind === 'sheet' ? [{ id: t.id, name: t.name, of: kind }] : [];
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
