// Whether the right rail (Page Info) is collapsed to its strip, kept on this device like the page tree's
// (owner 2026-11-21: "add a minimize button ... like we do with the left sidebar").
import { useSyncExternalStore } from 'react';
import {
  readLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

const KEY = 'liveknowledge:v2:page-rail-collapsed';
const listeners = new Set<() => void>();
let collapsed: boolean | null = null;

const read = (): boolean => (collapsed ??= readLocalStorageSafe(KEY) === '1');

/** Collapse or open the rail. */
export function setPageRailCollapsed(next: boolean): void {
  collapsed = next;
  writeLocalStorageSafe(KEY, next ? '1' : '0');
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether the rail is collapsed to its strip. */
export function usePageRailCollapsed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
