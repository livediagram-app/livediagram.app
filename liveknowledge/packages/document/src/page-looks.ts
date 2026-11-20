// What a knowledgebase page no longer has (docs/specs/030-knowledgebase/page-surface.md "What a page no longer
// has"): a background or pattern of its own, a style of its own for its writing, and a lock. A page stored with
// any of them (an imported livedocuments file, a tab written before this) reads without them, here, where every
// stored tab is settled on its way in (`migrateStoredTab`), so nothing downstream draws or honours one and the next
// save writes the tab without them. Every page of a knowledgebase looks the same; the look is the knowledgebase's
// (`knowledgeStyle`).
import { isRecord } from '@liveworkspace/model-core/is-record';

function pageWithoutLooks(page: unknown): unknown {
  if (!isRecord(page) || page.kind !== 'article') return page;
  if (!('background' in page) && !('locked' in page)) return page;
  const { background: _background, locked: _locked, ...rest } = page;
  void _background;
  void _locked;
  return rest;
}

function flowWithoutStyle(flow: unknown): unknown {
  if (!isRecord(flow) || !('style' in flow)) return flow;
  const { style: _style, ...rest } = flow;
  void _style;
  return rest;
}

// The same list or record back when no entry changed, so a tab that carries none of it keeps its identity.
function mapped<T>(list: readonly T[], each: (v: T) => T): readonly T[] {
  let next: T[] | null = null;
  list.forEach((item, i) => {
    const out = each(item);
    if (out === item) return;
    next ??= [...list];
    next[i] = out;
  });
  return next ?? list;
}

/**
 * A stored tab without its pages' own looks: no page background, no page lock, no tab lock, no per-article style.
 * The same tab back when it holds none. Pages of another kind (a slide or an infographic page a JSON import still
 * carries) keep theirs.
 */
export function withoutPageLooks<T extends object>(tab: T): T {
  const t = tab as Record<string, unknown>;
  let next: Record<string, unknown> | null = null;
  if (t.locked !== undefined) {
    const { locked: _locked, ...rest } = t;
    void _locked;
    next = rest;
  }
  if (Array.isArray(t.pages)) {
    const pages = mapped(t.pages as unknown[], pageWithoutLooks);
    if (pages !== t.pages) next = { ...(next ?? t), pages };
  }
  if (isRecord(t.articles)) {
    let articles: Record<string, unknown> | null = null;
    for (const [flow, raw] of Object.entries(t.articles)) {
      const out = flowWithoutStyle(raw);
      if (out === raw) continue;
      articles ??= { ...t.articles };
      articles[flow] = out;
    }
    if (articles) next = { ...(next ?? t), articles };
  }
  return (next ?? tab) as T;
}
