// A page's draft (docs/specs/030-knowledgebase/editing.md; blueprint blueprints/editing.md): the one shared draft the
// people in edit mode write together, stored beside the saved writing as a second article flow (`articles.draft`)
// with its record (`Tab.draft`). The saved writing is every other flow; whatever reads a page for a reader, the
// index or an agent reads `savedArticlesOf`. Pure: a tab in, a tab or an answer out. Shared by the editor and the api.
import { articlesOf, sameArticleValue, type ArticleBlock, type ArticleFlow } from './article-flow';
import { withArticleFlow } from './article-pages';
import { withArticlePageHeight } from './knowledgebase-page';
import { pagesOf } from './page';
import { titleNameOf } from './page-title';
import type { Tab } from './tab-type';

/** The draft's flow id: an article id (`isArticleId`) no generated flow id (`art-N`) can be. */
export const DRAFT_FLOW = 'draft';
/** A draft nobody has changed for this long is thrown away by the room's daily upkeep. */
export const DRAFT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
/** How stale the record's `at` may grow while the same person writes: "2 hours ago" never needs better. */
export const DRAFT_TOUCH_MS = 60_000;
/** A person's display name, cut as presence cuts it. */
export const DRAFT_BY_MAX = 80;

export type TabDraft = {
  // Who last changed the draft (their display name) and when (ms since the epoch).
  by: string;
  at: number;
  // The draft's page height (canvas px), as its writer laid it out; absent until laid out.
  height?: number;
  // Each saved block's print when the draft was made, by block id: what Save merges an agent's write against.
  base: Record<string, string>;
};

export const isDraftFlow = (flow: string): boolean => flow === DRAFT_FLOW;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A stored draft record read defensively; undefined for anything that is not one. */
export function parseTabDraft(v: unknown): TabDraft | undefined {
  if (!isRecord(v)) return undefined;
  if (typeof v.by !== 'string' || typeof v.at !== 'number' || !Number.isFinite(v.at)) return undefined;
  const base: Record<string, string> = {};
  if (isRecord(v.base)) {
    let n = 0;
    for (const [id, print] of Object.entries(v.base)) {
      if (typeof print !== 'string' || id.length === 0 || id.length > 64) continue;
      if (++n > 5000) break;
      base[id] = print;
    }
  }
  const out: TabDraft = { by: v.by.slice(0, DRAFT_BY_MAX), at: v.at, base };
  if (typeof v.height === 'number' && Number.isFinite(v.height) && v.height > 0) out.height = v.height;
  return out;
}

const savedCache = new WeakMap<object, Readonly<Record<string, ArticleFlow>>>();

/** The page's saved writing: every flow but the draft's. The same object back while the tab's `articles` is. */
export function savedArticlesOf(tab: object | undefined): Readonly<Record<string, ArticleFlow>> {
  const all = articlesOf(tab);
  if (!Object.hasOwn(all, DRAFT_FLOW)) return all;
  const cached = savedCache.get(all);
  if (cached) return cached;
  const { [DRAFT_FLOW]: _draft, ...saved } = all;
  void _draft;
  savedCache.set(all, saved);
  return saved;
}

/** The flow the page's writing is saved in: its first article page's, else its first saved flow. */
export function savedFlowOf(tab: Pick<Tab, 'pages' | 'articles'>): string | undefined {
  const saved = savedArticlesOf(tab);
  for (const page of pagesOf(tab)) {
    if (page.kind === 'article' && page.flow && saved[page.flow]) return page.flow;
  }
  return Object.keys(saved)[0];
}

/** The page's saved writing (its saved flow's), or undefined for a tab with none. */
export function savedArticleOf(tab: Pick<Tab, 'pages' | 'articles'>): ArticleFlow | undefined {
  const flow = savedFlowOf(tab);
  return flow ? savedArticlesOf(tab)[flow] : undefined;
}

/** The page's open draft: its writing and its record. Null when either half is missing. */
export function draftOf(
  tab: Pick<Tab, 'articles' | 'draft'>,
): { flow: ArticleFlow; record: TabDraft } | null {
  const flow = articlesOf(tab)[DRAFT_FLOW];
  if (!flow) return null;
  const record = parseTabDraft(tab.draft);
  return record ? { flow, record } : null;
}

/** Whether the tab holds either half of a draft. */
export function holdsDraft(tab: object): boolean {
  const t = tab as { articles?: unknown; draft?: unknown };
  return t.draft !== undefined || (isRecord(t.articles) && Object.hasOwn(t.articles, DRAFT_FLOW));
}

/** A stored tab as a reader is given it: neither the draft's writing nor its record. The same tab when it has none. */
export function withoutDraft<T extends object>(tab: T): T {
  if (!holdsDraft(tab)) return tab;
  const { draft: _record, ...rest } = tab as T & { draft?: unknown; articles?: unknown };
  void _record;
  const articles = rest.articles;
  if (isRecord(articles) && Object.hasOwn(articles, DRAFT_FLOW)) {
    const { [DRAFT_FLOW]: _flow, ...kept } = articles;
    void _flow;
    return { ...rest, articles: kept } as T;
  }
  return rest as T;
}

// FNV-1a, 32 bits, over a string: a block's print. Not a security hash: it tells two versions of a block apart.
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const blockPrints = new WeakMap<object, string>();

/** A block's print: the same for two blocks of the same value. Kept per block object. */
export function blockPrint(block: ArticleBlock): string {
  const cached = blockPrints.get(block);
  if (cached !== undefined) return cached;
  const print = fnv1a(JSON.stringify(block));
  blockPrints.set(block, print);
  return print;
}

/** Every block's print, by id. */
export function printsOf(flow: ArticleFlow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of flow.blocks) out[block.id] = blockPrint(block);
  return out;
}

/** The tab with a draft made of `writing` (the saved page as the editor changed it), from its saved blocks. */
export function withDraftMade(
  tab: Tab,
  writing: ArticleFlow,
  by: string,
  at: number,
  height?: number,
): Tab {
  const saved = savedArticleOf(tab);
  const record: TabDraft = {
    by: by.slice(0, DRAFT_BY_MAX),
    at,
    base: saved ? printsOf(saved) : {},
    ...(height !== undefined && height > 0 ? { height } : {}),
  };
  return { ...withArticleFlow(tab, DRAFT_FLOW, writing), draft: record };
}

/** The record as `by` changing the draft at `at` leaves it: the same record within DRAFT_TOUCH_MS of the same person. */
export function touchedDraft(record: TabDraft, by: string, at: number): TabDraft {
  const name = by.slice(0, DRAFT_BY_MAX);
  if (record.by === name && at - record.at < DRAFT_TOUCH_MS) return record;
  return { ...record, by: name, at };
}

/** The tab without its draft, both halves. The same tab when it has none. */
export function withDraftDiscarded(tab: Tab): Tab {
  return withoutDraft(tab);
}

/**
 * The writing Save stores: the draft, except where an agent wrote the saved page after the draft was made. A block
 * the draft left as the base had it, and the saved page changed, takes the saved page's version; a block the saved
 * page gained is kept after the block it follows there; a block the saved page lost and the draft left alone stays
 * lost. A block the draft changed is the draft's, whatever the saved page did. With nothing written under the draft,
 * the draft itself.
 */
export function mergeDraftOverSaved(
  base: Readonly<Record<string, string>>,
  draft: ArticleFlow,
  saved: ArticleFlow | undefined,
): ArticleFlow {
  if (!saved || savedMovedBlocks(base, saved) === 0) return draft;
  const savedById = new Map(saved.blocks.map((b) => [b.id, b] as const));
  const draftIds = new Set(draft.blocks.map((b) => b.id));
  const out: ArticleBlock[] = [];
  for (const block of draft.blocks) {
    const was = base[block.id];
    const untouched = was !== undefined && blockPrint(block) === was;
    if (!untouched) {
      out.push(block);
      continue;
    }
    const now = savedById.get(block.id);
    // The draft left it alone: the saved page's version, or gone when an agent removed it.
    if (now) out.push(blockPrint(now) === was ? block : now);
  }
  // Blocks the saved page gained since the draft was made, each after the nearest block before it that is kept.
  const placed = new Set(out.map((b) => b.id));
  let after: string | null = null;
  for (const block of saved.blocks) {
    if (placed.has(block.id)) {
      after = block.id;
      continue;
    }
    if (Object.hasOwn(base, block.id) || draftIds.has(block.id)) continue;
    const at = after === null ? 0 : out.findIndex((b) => b.id === after) + 1;
    out.splice(at, 0, block);
    placed.add(block.id);
    after = block.id;
  }
  return { ...draft, blocks: out };
}

// How many saved blocks are not as the base had them (changed, added or removed).
function savedMovedBlocks(base: Readonly<Record<string, string>>, saved: ArticleFlow): number {
  let moved = 0;
  const seen = new Set<string>();
  for (const block of saved.blocks) {
    seen.add(block.id);
    if (base[block.id] !== blockPrint(block)) moved++;
  }
  for (const id of Object.keys(base)) if (!seen.has(id)) moved++;
  return moved;
}

/** How many blocks of the saved page were changed under the open draft (an agent's write); 0 with no draft. */
export function savedChangesUnderDraft(tab: Tab): number {
  const draft = draftOf(tab);
  const saved = savedArticleOf(tab);
  if (!draft || !saved) return 0;
  return savedMovedBlocks(draft.record.base, saved);
}

/** Whether the open draft says anything the saved page does not. False with no draft. */
export function draftDiffers(tab: Tab): boolean {
  const draft = draftOf(tab);
  if (!draft) return false;
  const saved = savedArticleOf(tab);
  return !saved || !sameArticleValue(draft.flow, saved);
}

/**
 * The tab with its draft saved: the saved flow takes the draft's writing (merged over an agent's write,
 * `mergeDraftOverSaved`), the page its name from the Title and its height from the draft, and the draft goes.
 * The same tab when it holds no draft; a stray half of one is dropped.
 */
export function withDraftSaved(tab: Tab): Tab {
  const draft = draftOf(tab);
  if (!draft) return withDraftDiscarded(tab);
  const flow = savedFlowOf(tab);
  if (!flow) return withDraftDiscarded(tab);
  const saved = savedArticlesOf(tab)[flow];
  const writing = mergeDraftOverSaved(draft.record.base, draft.flow, saved);
  let next = withArticleFlow(tab, flow, writing);
  const name = titleNameOf(writing.blocks);
  if (name && name !== next.name) next = { ...next, name };
  if (draft.record.height !== undefined)
    next = withArticlePageHeight(next, flow, draft.record.height);
  return withDraftDiscarded(next);
}

/** Whether the room's daily upkeep throws this tab's draft away: a record untouched for DRAFT_KEEP_MS. */
export function draftIsStale(tab: Pick<Tab, 'draft'>, now: number): boolean {
  const record = parseTabDraft(tab.draft);
  return record !== undefined && now - record.at >= DRAFT_KEEP_MS;
}
