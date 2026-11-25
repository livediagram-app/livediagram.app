'use client';

// The width a left sidebar draws at (liveworkspace/docs/specs/011-workbench/sidebar-width.md), shared by the sidebar,
// its resize handle and the chrome that stands beside it: one store per storage key, so a drag moves all of them in the
// same frame. The default follows the window in steps (one media query each), never on every pixel of a resize.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useMediaQuery } from '@liveworkspace/ui';
import { createListeners, type Listeners } from '../../lib/listeners';
import {
  clampSidebarWidth,
  readSidebarWidth,
  SIDEBAR_WIDTH_STEPS,
  sidebarDefaultWidth,
  writeSidebarWidth,
} from '../../lib/sidebar-width';

type Store = Listeners & { value: number | null; read: boolean };

const stores = new Map<string, Store>();

function storeFor(key: string): Store {
  let store = stores.get(key);
  if (!store) {
    store = { ...createListeners(), value: null, read: false };
    stores.set(key, store);
  }
  return store;
}

function chosen(key: string): number | null {
  const store = storeFor(key);
  if (!store.read) {
    store.value = readSidebarWidth(key);
    store.read = true;
  }
  return store.value;
}

function put(key: string, value: number | null, keep: boolean): void {
  const store = storeFor(key);
  const next = value === null ? null : clampSidebarWidth(value);
  store.read = true;
  if (keep) writeSidebarWidth(key, next);
  if (store.value === next) return;
  store.value = next;
  store.notify();
}

/** Forgets every store's cached width (a test's reset). */
export function resetSidebarWidthStores(): void {
  for (const store of stores.values()) store.clear();
  stores.clear();
}

const noWidth = () => null;
const [WIDE, WIDER, WIDEST] = [...SIDEBAR_WIDTH_STEPS].reverse() as [
  (typeof SIDEBAR_WIDTH_STEPS)[number],
  (typeof SIDEBAR_WIDTH_STEPS)[number],
  (typeof SIDEBAR_WIDTH_STEPS)[number],
];

/** The window width the step media queries say the window has reached (0 below the first step). */
function useWindowStep(): number {
  const wide = useMediaQuery(`(min-width: ${WIDE.minWindow}px)`);
  const wider = useMediaQuery(`(min-width: ${WIDER.minWindow}px)`);
  const widest = useMediaQuery(`(min-width: ${WIDEST.minWindow}px)`);
  return widest ? WIDEST.minWindow : wider ? WIDER.minWindow : wide ? WIDE.minWindow : 0;
}

export type SidebarWidth = {
  /** What the sidebar draws at now, px at the panels' UI scale: the chosen width, or the default. */
  width: number;
  /** The default for this window. */
  defaultWidth: number;
  /** The width the person chose, or null for the default. */
  custom: number | null;
  /** Sets the width live (a drag's move), not yet kept. */
  set: (width: number) => void;
  /** Sets and keeps the width (a drag's end, a key). */
  commit: (width: number) => void;
  /** Back to the default, forgetting the chosen width. */
  reset: () => void;
};

/** The width of the sidebar kept under `key`, whose own width below the first step is `base`. */
export function useSidebarWidth(key: string, base: number): SidebarWidth {
  const store = storeFor(key);
  const custom = useSyncExternalStore(store.subscribe, () => chosen(key), noWidth);
  const defaultWidth = sidebarDefaultWidth(base, useWindowStep());
  const set = useCallback((w: number) => put(key, w, false), [key]);
  const commit = useCallback((w: number) => put(key, w, true), [key]);
  const reset = useCallback(() => put(key, null, true), [key]);
  return useMemo(
    () => ({ width: custom ?? defaultWidth, defaultWidth, custom, set, commit, reset }),
    [custom, defaultWidth, set, commit, reset],
  );
}
