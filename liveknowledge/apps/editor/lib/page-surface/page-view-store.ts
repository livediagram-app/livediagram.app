// The narrow view's store (docs/specs/030-knowledgebase/blueprints/page-surface.md "The narrow view"): the widest
// column this window allows, and per page the layout this browser measured at that column (the page's height, where
// each zone and margin note stands). The viewer's own: never synced, never stored, gone with the window. A plain
// subscribable module store, like drawing-zone-store.ts; one immutable state, replaced on a change, so a reader
// compares by identity.
import { useSyncExternalStore } from 'react';
import type { ArticleZoneAt } from '@liveknowledge/document';

/** What the narrow layout of one page measured. */
export type NarrowLayout = {
  readonly height?: number;
  readonly zones: ReadonlyMap<string, ArticleZoneAt>;
  readonly notes: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
};

export type PageViewState = {
  /** The widest column the window allows, screen px (page-lock.ts roomColumnOf); null before a page surface measured. */
  readonly room: number | null;
  readonly layouts: ReadonlyMap<string, NarrowLayout>;
};

/** The most pages whose narrow layout is kept: the pages read lately in this window. */
export const PAGE_VIEW_LAYOUTS_KEPT = 32;
// Under this far (canvas px) a measured place has not moved: layout noise (article-zones.ts SETTLE_TOLERANCE).
const MOVE_TOLERANCE = 0.75;

const EMPTY: PageViewState = { room: null, layouts: new Map() };
let state: PageViewState = EMPTY;
const listeners = new Set<() => void>();

const set = (next: PageViewState) => {
  state = next;
  for (const listener of listeners) listener();
};

export const pageViewState = (): PageViewState => state;

export function subscribePageView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The window's room for a column; the same room again tells nobody. */
export function setPageRoomColumn(room: number | null): void {
  if (room === state.room) return;
  set({ ...state, room });
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < MOVE_TOLERANCE && Math.abs(a.y - b.y) < MOVE_TOLERANCE;

function samePlaces<T extends { x: number; y: number; page?: string }>(
  a: ReadonlyMap<string, T>,
  b: ReadonlyMap<string, T>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, p] of a) {
    const q = b.get(id);
    if (!q || q.page !== p.page || !near(p, q)) return false;
  }
  return true;
}

/**
 * A page's narrow layout as measured: kept, and its readers told, only when something moved. Places measured within
 * the tolerance of the kept ones keep the kept ones, so the lens drawn from them is the same lens.
 */
export function notePageViewLayout(tabId: string, layout: NarrowLayout): void {
  const was = state.layouts.get(tabId);
  if (
    was &&
    was.height === layout.height &&
    samePlaces(was.zones, layout.zones) &&
    samePlaces(was.notes, layout.notes)
  )
    return;
  const layouts = new Map(state.layouts);
  layouts.delete(tabId);
  layouts.set(tabId, layout);
  // The oldest go first: a Map keeps the order its keys were set in.
  for (const id of layouts.keys()) {
    if (layouts.size <= PAGE_VIEW_LAYOUTS_KEPT) break;
    layouts.delete(id);
  }
  set({ ...state, layouts });
}

/** The state, redrawn when it changes. */
export function usePageViewState(): PageViewState {
  return useSyncExternalStore(subscribePageView, pageViewState, pageViewState);
}

/** Back to nothing measured: for tests. */
export function resetPageViewStore(): void {
  set(EMPTY);
}
