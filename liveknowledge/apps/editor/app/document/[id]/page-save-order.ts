// A new page's first save waits for its parent's (docs/specs/030-knowledgebase/blueprints/page-tree.md "The room's
// check"). The autosave writes every changed page side by side, so a subpage made in the same save as its parent (a
// page and its subpage added quickly, a Knowledgebase import's batch) could reach the api first and be refused
// `unknown_page`, then wait for the retry. Here a page's save is held until the first save of its parent, when that
// is in flight, has settled. Bounded: a parent whose save never runs releases its subpages after
// PARENT_SAVE_WAIT_MS, and they are then saved, or refused and retried, as before.

/** The longest a page's save waits for its parent's first save before it goes anyway. */
export const PARENT_SAVE_WAIT_MS = 15_000;

type FirstSave = { settled: Promise<void>; settle: () => void };

const firstSaves = new Map<string, FirstSave>();

/** A page the save about to start will store for the first time (called as the save is prepared, before any of
 *  its writes start, so a subpage finds its parent's whatever order they are written in). */
export function expectFirstSave(tabId: string, waitMs = PARENT_SAVE_WAIT_MS): void {
  if (firstSaves.has(tabId)) return;
  let settle = () => {};
  const settled = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const timer = setTimeout(() => settleFirstSave(tabId), waitMs);
  firstSaves.set(tabId, {
    settled,
    settle: () => {
      clearTimeout(timer);
      settle();
    },
  });
}

function settleFirstSave(tabId: string): void {
  const first = firstSaves.get(tabId);
  if (!first) return;
  firstSaves.delete(tabId);
  first.settle();
}

/** Runs a page's write once its parent's first save, if one is in flight, has settled (stored or refused). */
export async function savePageAfterParent<R>(
  tab: { id: string; parent?: string },
  put: () => Promise<R>,
): Promise<R> {
  const parent = tab.parent ? firstSaves.get(tab.parent) : undefined;
  if (parent) await parent.settled;
  try {
    return await put();
  } finally {
    settleFirstSave(tab.id);
  }
}

/** How many first saves are being waited on (for tests). */
export const pendingFirstSaves = (): number => firstSaves.size;
