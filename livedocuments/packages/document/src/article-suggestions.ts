// Suggestions in an article's writing (docs/specs/007-editor/suggestions.md): marks on runs (an insertion, a
// deletion, a format change) and on a text block (its break put in or taken out), and deciding them. Pure: the
// editor, the room, exports and agents' reads all resolve suggestions here, so the rejected view is one thing.
import {
  articlesOf,
  MAX_ARTICLE_BLOCK_TEXT,
  normaliseRuns,
  RUN_FLAGS,
  sameArticleValue,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleListBlock,
  type ArticleParagraphBlock,
  type ArticleRun,
  type ArticleRunFormat,
  type ArticleSuggestion,
} from './article-flow';
import {
  MAX_ARTICLE_CELL_RUNS,
  MAX_ARTICLE_CELL_TEXT,
  type ArticleTableBlock,
} from './article-table';

export type SuggestionDecision = 'accept' | 'reject';
/** What to do with one suggestion: accept it, reject it, or leave it (null). */
export type SuggestionDecide = (s: ArticleSuggestion) => SuggestionDecision | null;

type TextBlock = ArticleParagraphBlock | ArticleListBlock;
const isTextBlock = (b: ArticleBlock | undefined): b is TextBlock =>
  b !== undefined && (b.type === 'paragraph' || b.type === 'list');

const FORMAT_KEYS = [...RUN_FLAGS, 'href', 'color', 'hl'] as const;

/** A run's formatting, as a format change keeps it. */
export function runFormatOf(run: ArticleRun): ArticleRunFormat {
  const out: Record<string, unknown> = {};
  for (const key of FORMAT_KEYS) if (run[key] !== undefined) out[key] = run[key];
  return out;
}

/** The run with `format` in place of its own formatting. */
export function withRunFormat(run: ArticleRun, format: ArticleRunFormat): ArticleRun {
  const out: Record<string, unknown> = { ...run };
  for (const key of FORMAT_KEYS) delete out[key];
  return { ...(out as ArticleRun), ...format };
}

const withoutMark = (run: ArticleRun): ArticleRun => {
  const { sg: _sg, ...rest } = run;
  void _sg;
  return rest;
};

/** Runs with each decided suggestion resolved: an insertion accepted keeps its words, rejected drops them; a
 *  deletion accepted drops its words, rejected keeps them; a format change accepted keeps the new format, rejected
 *  puts `was` back. `decided` counts the runs decided; the same runs back when none was. */
export function resolveArticleRuns(
  runs: readonly ArticleRun[],
  decide: SuggestionDecide,
  limit: number = MAX_ARTICLE_BLOCK_TEXT,
  maxRuns?: number,
): { runs: ArticleRun[]; decided: number } {
  let decided = 0;
  const out: ArticleRun[] = [];
  for (const run of runs) {
    const sg = run.sg;
    const d = sg ? decide(sg) : null;
    if (!sg || !d) {
      out.push(run);
      continue;
    }
    decided += 1;
    const plain = withoutMark(run);
    if (sg.k === 'ins') {
      if (d === 'accept') out.push(plain);
    } else if (sg.k === 'del') {
      if (d === 'reject') out.push(plain);
    } else out.push(d === 'accept' ? plain : withRunFormat(plain, sg.was ?? {}));
  }
  if (decided === 0) return { runs: runs as ArticleRun[], decided: 0 };
  return { runs: normaliseRuns(out, limit, maxRuns), decided };
}

const textLength = (runs: readonly ArticleRun[]) => runs.reduce((n, r) => n + r.text.length, 0);

function resolveTable(
  table: ArticleTableBlock,
  decide: SuggestionDecide,
): { block: ArticleTableBlock; decided: number } {
  let decided = 0;
  const rows = table.rows.map((row) => {
    let changed = false;
    const cells = row.cells.map((cell) => {
      const r = resolveArticleRuns(cell, decide, MAX_ARTICLE_CELL_TEXT, MAX_ARTICLE_CELL_RUNS);
      if (r.decided === 0) return cell;
      decided += r.decided;
      changed = true;
      return r.runs;
    });
    return changed ? { ...row, cells } : row;
  });
  return decided ? { block: { ...table, rows }, decided } : { block: table, decided: 0 };
}

/**
 * The writing with each decided suggestion resolved (docs/specs/007-editor/suggestions.md "What a suggestion is"). A
 * break put in and rejected, or taken out and accepted, joins its block onto the text block just before it (the
 * earlier block's id and attributes kept); with no text block there, or when the two together would pass a block's
 * limit, an empty block goes and any other keeps its words. The same flow back when nothing was decided.
 */
export function resolveArticleSuggestions(
  flow: ArticleFlow,
  decide: SuggestionDecide,
): { flow: ArticleFlow; decided: number } {
  let decided = 0;
  const blocks: ArticleBlock[] = [];
  for (const original of flow.blocks) {
    let block = original;
    if (block.type === 'table') {
      const t = resolveTable(block, decide);
      decided += t.decided;
      blocks.push(t.block);
      continue;
    }
    if (!isTextBlock(block)) {
      blocks.push(block);
      continue;
    }
    const r = resolveArticleRuns(block.runs, decide);
    if (r.decided) {
      decided += r.decided;
      block = { ...block, runs: r.runs };
    }
    const sg = block.sg;
    const d = sg ? decide(sg) : null;
    if (!sg || !d) {
      blocks.push(block);
      continue;
    }
    decided += 1;
    const { sg: _sg, ...plain } = block;
    void _sg;
    const joins = (sg.k === 'ins') === (d === 'reject');
    if (!joins) {
      blocks.push(plain);
      continue;
    }
    const prev = blocks[blocks.length - 1];
    if (
      isTextBlock(prev) &&
      textLength(prev.runs) + textLength(plain.runs) <= MAX_ARTICLE_BLOCK_TEXT
    ) {
      blocks[blocks.length - 1] = { ...prev, runs: normaliseRuns([...prev.runs, ...plain.runs]) };
      continue;
    }
    if (plain.runs.length > 0) blocks.push(plain);
  }
  if (decided === 0) return { flow, decided: 0 };
  if (blocks.length === 0) blocks.push({ id: flow.blocks[0]!.id, type: 'paragraph', runs: [] });
  return { flow: flow.style ? { blocks, style: flow.style } : { blocks }, decided };
}

const rejectAll: SuggestionDecide = () => 'reject';
const acceptAll: SuggestionDecide = () => 'accept';
const rejected = new WeakMap<ArticleFlow, ArticleFlow>();

/** The writing as if every suggestion were rejected: what exports, presenting, a Viewer and agents read. The same
 *  flow back when it holds none; memoised per flow object. */
export function rejectedArticleFlow(flow: ArticleFlow): ArticleFlow {
  const hit = rejected.get(flow);
  if (hit) return hit;
  const out = articleHasSuggestions(flow) ? resolveArticleSuggestions(flow, rejectAll).flow : flow;
  rejected.set(flow, out);
  return out;
}

/** The writing as if every suggestion were accepted. */
export function acceptedArticleFlow(flow: ArticleFlow): ArticleFlow {
  return resolveArticleSuggestions(flow, acceptAll).flow;
}

const runsHold = (runs: readonly ArticleRun[]) => runs.some((r) => r.sg !== undefined);

const holding = new WeakMap<ArticleFlow, boolean>();

/** Whether the writing holds any suggestion (a run's, a break's, a table cell's). Memoised per flow object. */
export function articleHasSuggestions(flow: ArticleFlow): boolean {
  const hit = holding.get(flow);
  if (hit !== undefined) return hit;
  const has = flow.blocks.some((b) =>
    b.type === 'table'
      ? b.rows.some((row) => row.cells.some(runsHold))
      : isTextBlock(b) && (b.sg !== undefined || runsHold(b.runs)),
  );
  holding.set(flow, has);
  return has;
}

/** The tab with every article in its rejected view; the same tab when none holds a suggestion. */
export function withArticlesRejected<T extends object>(tab: T): T {
  const articles = articlesOf(tab);
  let next: Record<string, ArticleFlow> | null = null;
  for (const [flow, doc] of Object.entries(articles)) {
    const clean = rejectedArticleFlow(doc);
    if (clean === doc) continue;
    next ??= { ...articles };
    next[flow] = clean;
  }
  return next ? { ...tab, articles: next } : tab;
}

/** One suggestion as the editor lists it: its fields, the block it starts in, and its words (a break's are empty). */
export type ArticleSuggestionEntry = {
  suggestion: ArticleSuggestion;
  block: string;
  text: string;
  // A break's suggestion (on the block, not its runs).
  isBreak: boolean;
};

function addEntry(
  out: Map<string, ArticleSuggestionEntry>,
  sg: ArticleSuggestion,
  block: string,
  text: string,
  isBreak: boolean,
): void {
  const key = `${isBreak ? 'b' : 'r'}:${sg.id}`;
  const was = out.get(key);
  if (was) was.text += text;
  else out.set(key, { suggestion: sg, block, text, isBreak });
}

function entriesOf(flow: ArticleFlow): Map<string, ArticleSuggestionEntry> {
  const out = new Map<string, ArticleSuggestionEntry>();
  const runs = (list: readonly ArticleRun[], block: string) => {
    for (const r of list) if (r.sg) addEntry(out, r.sg, block, r.text, false);
  };
  for (const b of flow.blocks) {
    if (b.type === 'table')
      for (const row of b.rows) for (const cell of row.cells) runs(cell, b.id);
    if (!isTextBlock(b)) continue;
    if (b.sg) addEntry(out, b.sg, b.id, '', true);
    runs(b.runs, b.id);
  }
  return out;
}

/** Every suggestion in the writing, in its order, one entry per suggestion. */
export function articleSuggestionList(flow: ArticleFlow): ArticleSuggestionEntry[] {
  return articleHasSuggestions(flow) ? [...entriesOf(flow).values()] : [];
}

// The writing with margin note marks taken off: a Participant on Suggest Only may comment on selected text.
function withoutNoteMarks(flow: ArticleFlow): unknown {
  const strip = (runs: readonly ArticleRun[]) =>
    runs.map(({ note: _n, nk: _k, ...rest }) => {
      void _n;
      void _k;
      return rest;
    });
  return {
    style: flow.style,
    blocks: flow.blocks.map((b) =>
      b.type === 'table'
        ? { ...b, rows: b.rows.map((row) => ({ ...row, cells: row.cells.map(strip) })) }
        : isTextBlock(b)
          ? { ...b, runs: normaliseRuns(strip(b.runs)) }
          : b,
    ),
  };
}

/**
 * The suggestion rule (docs/specs/007-editor/suggestions.md "The server is the rule"): whether `after` is `before`
 * with only suggestions by `by` added or changed. The rejected views match (margin note marks aside); every
 * suggestion by anyone else is exactly as it was; every new one is `by`'s own, never Generated by AI.
 */
export function suggestionRuleHolds(before: ArticleFlow, after: ArticleFlow, by: string): boolean {
  if (
    !sameArticleValue(
      withoutNoteMarks(rejectedArticleFlow(before)),
      withoutNoteMarks(rejectedArticleFlow(after)),
    )
  )
    return false;
  const was = entriesOf(before);
  const now = entriesOf(after);
  for (const [key, entry] of was) {
    if (entry.suggestion.by === by) continue;
    const kept = now.get(key);
    if (!kept || !sameArticleValue(entry.suggestion, kept.suggestion) || kept.text !== entry.text)
      return false;
  }
  for (const [key, entry] of now) {
    if (was.has(key)) continue;
    const s = entry.suggestion;
    if (s.by !== by || s.ai || s.g) return false;
  }
  return true;
}
