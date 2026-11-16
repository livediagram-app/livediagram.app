// The articles an editor that is not their writer may still grow (docs/specs/024-agents/
// pages-for-agents.md "Pages for the writing"): one an agent just wrote (its relayed `article`
// op says `agent`), and every article of a tab as it loads (a writer who left before settling). The
// next lay-out of each takes its mark, growing it if its writing reaches past its pages. Once grown, the mark stays
// for a few lay-outs, measured on the real pages, to settle the pages the grow added (`floor`: the count it found).
export const ARTICLE_GROW_SETTLE_TRIES = 4;
const pending = new Map<string, { floor: number | null; grows: number }>();

const key = (tabId: string, flow: string) => `${tabId}\u0000${flow}`;

export function markArticleGrow(tabId: string, flow: string): void {
  pending.set(key(tabId, flow), { floor: null, grows: 0 });
}

export function isArticleGrowPending(tabId: string, flow: string): boolean {
  return pending.has(key(tabId, flow));
}

/** The page count the article had before this editor first grew it, or null before it has. */
export function articleGrowFloor(tabId: string, flow: string): number | null {
  return pending.get(key(tabId, flow))?.floor ?? null;
}

/** A grow from `from` pages: the first sets the floor; the mark clears after ARTICLE_GROW_SETTLE_TRIES grows. */
export function noteArticleGrown(tabId: string, flow: string, from: number): void {
  const k = key(tabId, flow);
  const was = pending.get(k);
  if (!was) return;
  const grows = was.grows + 1;
  if (grows >= ARTICLE_GROW_SETTLE_TRIES) pending.delete(k);
  else pending.set(k, { floor: was.floor ?? from, grows });
}

export function clearArticleGrow(tabId: string, flow: string): void {
  pending.delete(key(tabId, flow));
}

// The articles an import here just wrote (docs/specs/020-import-export/office-import.md "One undo step"): the importer
// is their writer, so this editor settles their first layouts as it does its own typing (pages added, pictures'
// zones placed), for the writer's window from the first layout. A Word or Markdown import mounts a fresh article
// editor that has not been typed in, so without the claim nothing would add the pages its writing needs.
export const ARTICLE_SETTLE_WINDOW_MS = 3000;
const settling = new Map<string, number | null>();

export function markArticleSettle(tabId: string, flow: string): void {
  settling.set(key(tabId, flow), null);
}

/** Whether this editor settles the article's layout as its writer: true from the first layout after an import until
 *  the window closes, then forgotten. */
export function isArticleSettleClaimed(tabId: string, flow: string, now = Date.now()): boolean {
  const k = key(tabId, flow);
  if (!settling.has(k)) return false;
  const from = settling.get(k) ?? now;
  if (now - from < ARTICLE_SETTLE_WINDOW_MS) {
    settling.set(k, from);
    return true;
  }
  settling.delete(k);
  return false;
}
