// The articles an editor that is not their writer may still grow (docs/specs/024-agents/
// illustrate-for-agents.md "Pages for the writing"): one an agent just wrote (its relayed `article`
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
