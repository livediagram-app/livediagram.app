// The articles an editor that is not their writer may still grow (docs/specs/024-agents/
// pages-for-agents.md "Pages for the writing"): one an agent just wrote (its relayed `article`
// op says `agent`), and every article of a tab as it loads (a writer who left before settling). The
// next lay-out of each takes its mark, growing it if its writing reaches past its pages.
const pending = new Set<string>();

const key = (tabId: string, flow: string) => `${tabId}\u0000${flow}`;

export function markArticleGrow(tabId: string, flow: string): void {
  pending.add(key(tabId, flow));
}

export function isArticleGrowPending(tabId: string, flow: string): boolean {
  return pending.has(key(tabId, flow));
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
