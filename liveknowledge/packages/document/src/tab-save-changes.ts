// What one tab save changed, by id (docs/specs/012-collaboration/collab-race-hardening.md "A save is merged with the
// stored tab"): its page steps, and each article it changed as block steps, or whole, or gone. The editor sends it
// beside the whole tab (`X-Save-Changes`, @liveworkspace/api-schema/tab-save-changes), and the api applies it over
// the tab it has stored, so two Editors adding pages or writing in different paragraphs of one article at the same
// moment both keep their work after a reload (Work Tracker #669, #670). Elements are not here: they have the
// changeset merge and the room's ledger.
//
// The steps name blocks and pages by id and carry no payload: the saved tab beside them holds every block and page
// a step puts.
import type { IdListStep } from '@liveworkspace/model-core/id-list-steps';
import {
  pagesWithSteps,
  parsePageSteps,
  savedPagesOver,
  tabPageSteps,
  type PageCap,
} from '@liveworkspace/model-core/tab-page-steps';
import { articlesOf, isArticleId, type ArticleFlow } from './article-flow';
import { applyArticleOps, diffArticleFlow, type ArticleOp } from './article-flow-ops';
import { pagesOf, type Page } from './page';
import { MAX_PAGES } from './page-sizes';
import type { Tab } from './index';

/** An article op without its payload: the block, style or cell text comes from the saved tab. */
export type ArticleStep =
  | { kind: 'put'; id: string; after?: string | null; before?: string | null }
  | { kind: 'remove'; id: string }
  | { kind: 'style' }
  | { kind: 'cell'; block: string; row: string; col: string };

/** One article's change in a save: its block steps; `whole`, taken as saved (a new article, or a change too big to
 *  name block by block); or `removed`. */
export type ArticleSaveChange = ArticleStep[] | 'whole' | 'removed';

export type TabSaveChanges = {
  pages?: IdListStep[];
  articles?: Record<string, ArticleSaveChange>;
};

/** Bounds on what a request may name (anything past them is not read, and the tab is stored as sent). */
const MAX_ARTICLE_STEPS = 5_000;
const MAX_CHANGED_ARTICLES = 200;

const readPages = (tab: { pages?: unknown } | undefined) => pagesOf(tab);

/** A tab's page cap, held when pages from two Editors merge (collab-race-hardening.md "At the page cap"). */
const PAGE_CAPS: readonly PageCap<Page>[] = [{ max: MAX_PAGES }];

/** The steps a change from `before` to `after` makes to the tab's pages, by id (collab-race-hardening.md "Pages"):
 *  sent with every op that carries the pages, and with every save. */
export function pageStepsOf(before: Tab, after: Tab, previous?: Tab): IdListStep[] {
  return tabPageSteps(before, after, readPages, previous);
}

/** A peer's page change applied over `local`'s pages: its `steps`, each page from `sent` (the peer's whole list),
 *  both read defensively, so a page added here meanwhile stays. Null when the peer sent no readable steps (an older
 *  sender): its whole list then stands. */
export function withPeerPageSteps(local: Tab, steps: unknown, sent: unknown): Page[] | null {
  const read = parsePageSteps(steps);
  if (!read || !Array.isArray(sent)) return null;
  return pagesWithSteps(local, read, readPages({ pages: sent }), readPages, PAGE_CAPS);
}

/** The changes from `before` (the save baseline) to `after` (the tab saved). `previous` is this editor's last save
 *  of the tab while it may still be in flight: a page or block it held that `after` lacks is removed too, so one
 *  added and deleted again across two quick saves does not come back. */
export function tabSaveChanges(before: Tab, after: Tab, previous?: Tab): TabSaveChanges {
  return {
    pages: pageStepsOf(before, after, previous),
    articles: articleChanges(before, after, previous),
  };
}

function articleChanges(
  before: Tab,
  after: Tab,
  previous: Tab | undefined,
): Record<string, ArticleSaveChange> {
  const out: Record<string, ArticleSaveChange> = {};
  const extra = previous && previous.articles !== after.articles ? articlesOf(previous) : {};
  if (before.articles === after.articles && Object.keys(extra).length === 0) return out;
  const was = articlesOf(before);
  const now = articlesOf(after);
  for (const flow of new Set([...Object.keys(was), ...Object.keys(extra)])) {
    if (!(flow in now)) out[flow] = 'removed';
  }
  for (const [flow, doc] of Object.entries(now)) {
    const old = was[flow];
    if (!old) {
      out[flow] = 'whole';
      continue;
    }
    const steps = old === doc ? [] : diffArticleFlow(old, doc).map(stepOf);
    const had = extra[flow];
    if (had && had !== doc) {
      const kept = new Set([...old.blocks, ...doc.blocks].map((b) => b.id));
      for (const b of had.blocks) if (!kept.has(b.id)) steps.unshift({ kind: 'remove', id: b.id });
    }
    if (steps.length > 0) out[flow] = steps;
  }
  return out;
}

function stepOf(op: ArticleOp): ArticleStep {
  switch (op.kind) {
    case 'put':
      return {
        kind: 'put',
        id: op.block.id,
        ...(op.after !== undefined ? { after: op.after } : {}),
        ...(op.before !== undefined ? { before: op.before } : {}),
      };
    case 'remove':
      return op;
    case 'style':
      return { kind: 'style' };
    case 'cell':
      return { kind: 'cell', block: op.block, row: op.row, col: op.col };
  }
}

/** The same changes, smaller: every article it steps through taken whole. For a save whose steps would not fit in
 *  the header; past this too, the save sends no changes and is stored as sent. */
export function wholeArticleChanges(changes: TabSaveChanges): TabSaveChanges {
  const articles: Record<string, ArticleSaveChange> = {};
  for (const [flow, change] of Object.entries(changes.articles ?? {})) {
    articles[flow] = change === 'removed' ? 'removed' : 'whole';
  }
  return { ...changes, articles };
}

const placeOf = (v: unknown): string | null | undefined | false =>
  v === undefined || v === null ? v : isArticleId(v) ? v : false;

function parseArticleSteps(v: unknown): ArticleStep[] | null {
  if (!Array.isArray(v) || v.length > MAX_ARTICLE_STEPS) return null;
  const out: ArticleStep[] = [];
  for (const raw of v as unknown[]) {
    const o = raw as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') continue;
    if (o.kind === 'style') out.push({ kind: 'style' });
    else if (o.kind === 'remove' && isArticleId(o.id)) out.push({ kind: 'remove', id: o.id });
    else if (o.kind === 'cell') {
      if (isArticleId(o.block) && isArticleId(o.row) && isArticleId(o.col))
        out.push({ kind: 'cell', block: o.block, row: o.row, col: o.col });
    } else if (o.kind === 'put' && isArticleId(o.id)) {
      const after = placeOf(o.after);
      const before = placeOf(o.before);
      if (after === false || before === false) continue;
      out.push({
        kind: 'put',
        id: o.id,
        ...(after !== undefined ? { after } : {}),
        ...(before !== undefined ? { before } : {}),
      });
    }
  }
  return out;
}

/** A request's changes read defensively: each part that is malformed or past its bounds is dropped, and that part
 *  of the tab is then stored as sent. Null when nothing is readable. */
export function parseTabSaveChanges(v: Record<string, unknown> | null): TabSaveChanges | null {
  if (!v) return null;
  const out: TabSaveChanges = {};
  const pages = parsePageSteps(v.pages);
  if (pages) out.pages = pages;
  const raw = v.articles;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length <= MAX_CHANGED_ARTICLES) {
      const articles: Record<string, ArticleSaveChange> = {};
      let ok = true;
      for (const [flow, change] of entries) {
        const steps =
          change === 'whole' || change === 'removed' ? change : parseArticleSteps(change);
        if (!isArticleId(flow) || steps === null) {
          ok = false;
          break;
        }
        articles[flow] = steps;
      }
      if (ok) out.articles = articles;
    }
  }
  return out.pages || out.articles ? out : null;
}

/** The tab a save stores: `saved` as sent, but with its pages and articles merged over `stored` by the save's
 *  `changes`. A page or block the save did not change keeps the stored copy, a peer's one the save never saw stays,
 *  and what the save removed goes. An article the stored tab no longer has (a peer deleted it) comes back only when
 *  the save made it, or when a page of the merged tab still shows it. */
export function mergeSaveOverStored(stored: Tab, saved: Tab, changes: TabSaveChanges): Tab {
  const out: Tab = { ...saved };
  const pages = savedPagesOver(stored, saved, changes.pages, readPages, PAGE_CAPS);
  if (pages === undefined) delete out.pages;
  else out.pages = pages as Tab['pages'];
  if (changes.articles) {
    const articles = mergedArticles(stored, saved, changes.articles, out);
    if (Object.keys(articles).length > 0) out.articles = articles as Tab['articles'];
    else delete out.articles;
  }
  return out;
}

function mergedArticles(
  stored: Tab,
  saved: Tab,
  changes: Record<string, ArticleSaveChange>,
  merged: Tab,
): Record<string, unknown> {
  const rawStored = rawArticles(stored);
  const rawSaved = rawArticles(saved);
  const storedFlows = articlesOf(stored);
  const savedFlows = articlesOf(saved);
  const out: Record<string, unknown> = {};
  for (const [flow, raw] of Object.entries(rawStored)) {
    const change = changes[flow];
    if (change === 'removed') continue;
    if (change === undefined) out[flow] = raw;
    else if (change === 'whole') out[flow] = rawSaved[flow] ?? raw;
    else out[flow] = applyArticleOps(storedFlows[flow], resolveSteps(change, savedFlows[flow]));
  }
  const shown = new Set(pagesOf(merged).flatMap((p) => (p.flow ? [p.flow] : [])));
  for (const [flow, raw] of Object.entries(rawSaved)) {
    if (flow in rawStored) continue;
    // (A save never names an article it holds as removed.)
    if (changes[flow] === 'whole' || shown.has(flow)) out[flow] = raw;
  }
  return out;
}

function rawArticles(tab: Tab): Record<string, unknown> {
  const a = (tab as { articles?: unknown }).articles;
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
}

// The article ops the steps stand for, each payload from the saved article: a step naming a block, a table or a cell
// it lacks is dropped.
function resolveSteps(steps: readonly ArticleStep[], flow: ArticleFlow | undefined): ArticleOp[] {
  const byId = new Map((flow?.blocks ?? []).map((b) => [b.id, b] as const));
  const ops: ArticleOp[] = [];
  for (const step of steps) {
    if (step.kind === 'remove') ops.push(step);
    else if (step.kind === 'style') {
      if (flow) ops.push(flow.style ? { kind: 'style', style: flow.style } : { kind: 'style' });
    } else if (step.kind === 'put') {
      const block = byId.get(step.id);
      if (!block) continue;
      ops.push({
        kind: 'put',
        block,
        ...(step.after !== undefined ? { after: step.after } : {}),
        ...(step.before !== undefined ? { before: step.before } : {}),
      });
    } else {
      const table = byId.get(step.block);
      if (table?.type !== 'table') continue;
      const c = table.cols.findIndex((col) => col.id === step.col);
      const runs = table.rows.find((row) => row.id === step.row)?.cells[c];
      if (c >= 0 && runs) ops.push({ ...step, runs });
    }
  }
  return ops;
}
