// The height this browser measured a continuous page's writing to need, at full width (docs/specs/030-knowledgebase/
// blueprints/continuous-page.md "The drawn height"). The page's box is drawn at the taller of it and the stored
// height, so a page stored short (written in the narrow view or by an agent, then only read) still takes a press
// anywhere under its writing. The viewer's own: never stored, never synced, gone with the window. A plain subscribable
// module store, like page-view-store.ts; one immutable map per tab, replaced on a change, so a reader compares by
// identity.
import { useSyncExternalStore } from 'react';
import { isContinuousPage, type LaidOutPage } from '@liveknowledge/document';

/** What one layout measured: the page's width it was laid out at, and the height its writing needs (canvas px). */
export type MeasuredHeight = { readonly width: number; readonly height: number };
export type MeasuredHeights = ReadonlyMap<string, MeasuredHeight>;

/** The most tabs whose measures are kept: the pages read lately in this window. */
export const MEASURED_PAGES_KEPT = 32;

const NONE: MeasuredHeights = new Map();
let byTab = new Map<string, MeasuredHeights>();
const listeners = new Set<() => void>();

/** The measure of flow `flow` on tab `tabId`: kept, and its readers told, only when it moved. */
export function noteMeasuredPageHeight(
  tabId: string,
  flow: string,
  width: number,
  height: number,
): void {
  const was = byTab.get(tabId) ?? NONE;
  const kept = was.get(flow);
  if (kept && kept.width === width && kept.height === height) return;
  const flows = new Map(was);
  flows.set(flow, { width, height });
  const next = new Map(byTab);
  next.delete(tabId);
  next.set(tabId, flows);
  // The oldest go first: a Map keeps the order its keys were set in.
  for (const id of next.keys()) {
    if (next.size <= MEASURED_PAGES_KEPT) break;
    next.delete(id);
  }
  byTab = next;
  for (const listener of listeners) listener();
}

export const measuredPageHeightsOf = (tabId: string): MeasuredHeights => byTab.get(tabId) ?? NONE;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The tab's measures, by flow, redrawn when one moves. */
export function useMeasuredPageHeights(tabId: string): MeasuredHeights {
  const get = () => measuredPageHeightsOf(tabId);
  return useSyncExternalStore(subscribe, get, get);
}

/**
 * The height a page's box is drawn at: its stored height, or what this browser measured its writing to need when the
 * page is continuous, the measure was taken at the width it is drawn at (a full-width measure never stretches the
 * narrow view's page) and it is taller. Never shorter than stored.
 */
export function drawnPageHeight(page: LaidOutPage, measured: MeasuredHeights | undefined): number {
  const m = page.flow ? measured?.get(page.flow) : undefined;
  if (!m || !isContinuousPage(page) || m.width !== page.rect.width) return page.rect.height;
  return Math.max(page.rect.height, m.height);
}

/** The page with its box at its drawn height: the same page object when that is its stored height. */
export function withDrawnHeight(
  page: LaidOutPage,
  measured: MeasuredHeights | undefined,
): LaidOutPage {
  const height = drawnPageHeight(page, measured);
  return height === page.rect.height ? page : { ...page, rect: { ...page.rect, height } };
}

/** Back to nothing measured: for tests. */
export function resetMeasuredPageHeights(): void {
  byTab = new Map();
  for (const listener of listeners) listener();
}
