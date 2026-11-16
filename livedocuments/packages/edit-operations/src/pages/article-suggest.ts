// An assistant's article write as suggestions (docs/specs/024-agents/pages-for-agents.md "Suggestions"; blueprint
// docs/specs/007-editor/blueprints/suggestions.md "Agent writes"): the written article compared with the stored
// one's rejected view (what the agent read), its changed words made insertions and deletions by the assistant,
// formatting on kept words a format change, new blocks breaks put in, blocks left out breaks taken out. What has no
// suggestion form goes in as written and is counted in `direct`; a stored block holding someone else's suggestion
// stands and is counted in `kept`.
import {
  MAX_ARTICLE_BLOCK_TEXT,
  nextArticleBlockId,
  normaliseRuns,
  rejectedArticleFlow,
  runFormatOf,
  sameArticleValue,
  withRunFormat,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleListBlock,
  type ArticleParagraphBlock,
  type ArticleRun,
  type ArticleSuggestion,
  type ArticleSuggestionKind,
} from '@livedocuments/document';

/** Who suggests: every suggestion made carries it, with its own id. */
export type SuggestionAuthor = Omit<ArticleSuggestion, 'id' | 'k' | 'was'>;

export type SuggestedWrite = {
  flow: ArticleFlow;
  // Suggestions made.
  suggested: number;
  // What went in as written, by what it was ("table", "block style", ...), counted.
  direct: Map<string, number>;
  // Stored blocks left as they were: holding others' suggestions, or too long to hold the suggested words.
  kept: number;
  tooLong: number;
};

// The most edits a diff follows before it gives up on matching: past it, the stretch is all deleted and inserted,
// so a write that changes everything costs the same as one that changes little.
const MAX_EDITS = 2_000;

type Op = { k: 'eq'; a: number; b: number } | { k: 'del'; a: number } | { k: 'ins'; b: number };

/** A Myers diff of two key lists, as equal, deleted and inserted entries in order; past `maxEdits` edits the
 *  middle that differs is all deleted then all inserted. */
export function diffKeys(a: readonly string[], b: readonly string[], maxEdits = MAX_EDITS): Op[] {
  // The equal head and tail cost nothing to match.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const head: Op[] = [];
  for (let i = 0; i < start; i++) head.push({ k: 'eq', a: i, b: i });
  const tail: Op[] = [];
  for (let i = 0; endA + i < a.length; i++) tail.push({ k: 'eq', a: endA + i, b: endB + i });
  const n = endA - start;
  const m = endB - start;
  const middle = (): Op[] => {
    const out: Op[] = [];
    for (let i = start; i < endA; i++) out.push({ k: 'del', a: i });
    for (let j = start; j < endB; j++) out.push({ k: 'ins', b: j });
    return out;
  };
  if (n === 0 || m === 0) return [...head, ...middle(), ...tail];
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= max && found < 0; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)
          ? v[offset + k + 1]!
          : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[start + x] === b[start + y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found < 0) return [...head, ...middle(), ...tail];
  // Walk back through the trace.
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const vd = trace[d]!;
    const k = x - y;
    const down = k === -d || (k !== d && vd[offset + k - 1]! < vd[offset + k + 1]!);
    const prevK = down ? k + 1 : k - 1;
    const prevX = vd[offset + prevK]!;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) ops.push({ k: 'eq', a: start + --x, b: start + --y });
    if (down) ops.push({ k: 'ins', b: start + --y });
    else ops.push({ k: 'del', a: start + --x });
  }
  // The equal head was cut off first, so the walk ends at the start: no snake leads into it.
  ops.reverse();
  return [...head, ...ops, ...tail];
}

type TextBlock = ArticleParagraphBlock | ArticleListBlock;
const isText = (b: ArticleBlock | undefined): b is TextBlock =>
  b !== undefined && (b.type === 'paragraph' || b.type === 'list');

const plainText = (runs: readonly ArticleRun[]) =>
  runs.map((r) => (r.fn === undefined ? r.text : `${r.text}\u0001${r.fn}\u0001`)).join('');

// A block's key for matching: its kind and place in the outline, and its words.
function blockKey(b: ArticleBlock): string {
  if (b.type === 'paragraph') return `p:${b.style ?? ''}:${plainText(b.runs)}`;
  if (b.type === 'list') return `l:${b.list}:${b.level ?? 0}:${plainText(b.runs)}`;
  return `${b.type}:${JSON.stringify({ ...b, id: '' })}`;
}

// What a block's attributes are, apart from its words and id: a change here goes in as written.
const attrsOf = (b: TextBlock) => {
  const { id: _id, runs: _runs, sg: _sg, ...rest } = b;
  void _id;
  void _runs;
  void _sg;
  return rest;
};

const WORD = /[\p{L}\p{N}]+|\s+|[^\p{L}\p{N}\s]/gu;

type Piece = { run: ArticleRun; key: string };

// Runs cut into word tokens, each keeping its run's format. A footnote reference is one token.
function piecesOf(runs: readonly ArticleRun[]): Piece[] {
  const out: Piece[] = [];
  for (const run of runs) {
    if (run.fn !== undefined) {
      out.push({ run, key: `\u0001${run.text}\u0001${run.fn}` });
      continue;
    }
    for (const m of run.text.matchAll(WORD)) out.push({ run: { ...run, text: m[0] }, key: m[0] });
  }
  return out;
}

type Marker = (k: ArticleSuggestionKind, extra?: Partial<ArticleSuggestion>) => ArticleSuggestion;

// A block's words from `was` to `now`, as runs with suggestions: one suggestion per stretch of one kind.
function suggestedRuns(
  was: readonly ArticleRun[],
  now: readonly ArticleRun[],
  mark: Marker,
): { runs: ArticleRun[]; made: number } {
  const a = piecesOf(was);
  const b = piecesOf(now);
  const ops = diffKeys(
    a.map((p) => p.key),
    b.map((p) => p.key),
  );
  const out: ArticleRun[] = [];
  let made = 0;
  let open: { kind: string; sg: ArticleSuggestion } | null = null;
  const sgFor = (kind: ArticleSuggestionKind, key: string, extra?: Partial<ArticleSuggestion>) => {
    if (open?.kind === key) return open.sg;
    const sg = mark(kind, extra);
    made++;
    open = { kind: key, sg };
    return sg;
  };
  for (const op of ops) {
    if (op.k === 'del') out.push({ ...a[op.a]!.run, sg: sgFor('del', 'del') });
    else if (op.k === 'ins') out.push({ ...b[op.b]!.run, sg: sgFor('ins', 'ins') });
    else {
      const kept = a[op.a]!.run;
      const format = runFormatOf(b[op.b]!.run);
      const before = runFormatOf(kept);
      if (sameArticleValue(format, before)) {
        open = null;
        out.push(kept);
      } else {
        // One format change per stretch going from one format to the same other.
        const key = `fmt:${JSON.stringify(before)}>${JSON.stringify(format)}`;
        out.push({ ...withRunFormat(kept, format), sg: sgFor('fmt', key, { was: before }) });
      }
    }
  }
  return { runs: out, made };
}

const textLength = (runs: readonly ArticleRun[]) => runs.reduce((n, r) => n + r.text.length, 0);

// Runs that fit a block as they are: normaliseRuns would cut anything past a block's limits.
const fits = (runs: readonly ArticleRun[]) =>
  textLength(runs) <= MAX_ARTICLE_BLOCK_TEXT &&
  normaliseRuns(runs).length === normaliseRuns(runs, Infinity, Infinity).length;

const holdsOthers = (blocks: readonly ArticleBlock[], by: string) =>
  blocks.some((b) => {
    if (isText(b)) return (b.sg && b.sg.by !== by) || b.runs.some((r) => r.sg && r.sg.by !== by);
    if (b.type === 'table')
      return b.rows.some((row) => row.cells.some((c) => c.some((r) => r.sg && r.sg.by !== by)));
    return false;
  });

/**
 * `after` (an agent's write over `before`) as suggestions by `author` on `before`. `newId` mints suggestion ids
 * (random by default, `s-` and eight hex digits).
 */
export function suggestArticleWrite(
  before: ArticleFlow,
  after: ArticleFlow,
  author: SuggestionAuthor,
  newId: () => string = () => `s-${crypto.randomUUID().slice(0, 8)}`,
): SuggestedWrite {
  const base = rejectedArticleFlow(before);
  const direct = new Map<string, number>();
  const count = (what: string) => direct.set(what, (direct.get(what) ?? 0) + 1);
  let suggested = 0;
  let kept = 0;
  let tooLong = 0;
  const mark: Marker = (k, extra) => ({ id: newId(), k, ...author, ...extra });

  // Each base block's stored blocks: itself and any stored blocks after it that the rejected view joined into it or
  // dropped (they carry suggestions, so they stand with it).
  const baseIds = new Set(base.blocks.map((b) => b.id));
  const groups = new Map<string, ArticleBlock[]>();
  const lead: ArticleBlock[] = [];
  let current: ArticleBlock[] = lead;
  for (const b of before.blocks) {
    if (baseIds.has(b.id)) {
      current = [b];
      groups.set(b.id, current);
    } else current.push(b);
  }
  const taken = new Set(before.blocks.map((b) => b.id));
  const out: ArticleBlock[] = [...lead];

  // A stored block written again: as it is when nothing changed, else its words diffed.
  const changed = (baseBlock: TextBlock, written: TextBlock) => {
    const group = groups.get(baseBlock.id)!;
    if (holdsOthers(group, author.by)) {
      kept++;
      out.push(...group);
      return;
    }
    const words = suggestedRuns(baseBlock.runs, written.runs, mark);
    if (!fits(words.runs)) {
      tooLong++;
      out.push(...group);
      return;
    }
    suggested += words.made;
    if (!sameArticleValue(attrsOf(baseBlock), attrsOf(written))) count('block style');
    out.push({ ...written, id: baseBlock.id, runs: normaliseRuns(words.runs) });
  };
  const removed = (baseBlock: ArticleBlock) => {
    const group = groups.get(baseBlock.id)!;
    if (holdsOthers(group, author.by)) {
      kept++;
      out.push(...group);
      return;
    }
    if (!isText(baseBlock)) {
      count(baseBlock.type);
      return;
    }
    const sg = mark('del');
    const breakSg = mark('del');
    suggested += baseBlock.runs.length ? 2 : 1;
    const runs = baseBlock.runs.map((r) => ({ ...r, sg }));
    const { sg: _old, ...plain } = baseBlock;
    void _old;
    out.push({ ...plain, runs, sg: breakSg });
  };
  const added = (written: ArticleBlock) => {
    const id = taken.has(written.id) ? nextArticleBlockId(taken) : written.id;
    taken.add(id);
    if (!isText(written)) {
      count(written.type);
      out.push({ ...written, id });
      return;
    }
    const sg = mark('ins');
    const breakSg = mark('ins');
    suggested += written.runs.length ? 2 : 1;
    out.push({ ...written, id, runs: written.runs.map((r) => ({ ...r, sg })), sg: breakSg });
  };

  const ops = diffKeys(base.blocks.map(blockKey), after.blocks.map(blockKey));
  for (let i = 0; i < ops.length;) {
    const op = ops[i]!;
    if (op.k === 'eq') {
      const was = base.blocks[op.a]!;
      const now = after.blocks[op.b]!;
      // Same words: a formatting change on them is a format change; otherwise the stored blocks stand.
      if (isText(was) && isText(now) && !sameArticleValue(was.runs, now.runs)) changed(was, now);
      else out.push(...groups.get(was.id)!);
      i++;
      continue;
    }
    // A hunk: its deleted and inserted blocks, text blocks of one kind paired in order.
    const dels: ArticleBlock[] = [];
    const ins: ArticleBlock[] = [];
    while (i < ops.length && ops[i]!.k !== 'eq') {
      const o = ops[i]!;
      if (o.k === 'del') dels.push(base.blocks[o.a]!);
      else ins.push(after.blocks[(o as { b: number }).b]!);
      i++;
    }
    let d = 0;
    let n = 0;
    while (d < dels.length || n < ins.length) {
      const was = dels[d];
      const now = ins[n];
      if (isText(was) && isText(now) && was.type === now.type) {
        changed(was, now);
        d++;
        n++;
      } else if (was && (!now || !isText(was) || isText(now))) {
        // Nothing to pair it with, or two text blocks of different kinds: the old one goes first.
        removed(was);
        d++;
      } else {
        added(now!);
        n++;
      }
    }
  }
  if (!sameArticleValue(before.style ?? {}, after.style ?? {})) count('look');
  const flow: ArticleFlow = after.style ? { blocks: out, style: after.style } : { blocks: out };
  return { flow, suggested, direct, kept, tooLong };
}

const DIRECT_WORDS: Record<string, [string, string]> = {
  'block style': ['block style', 'block styles'],
  table: ['table', 'tables'],
  code: ['code block', 'code blocks'],
  toc: ['contents block', 'contents blocks'],
  zone: ['zone', 'zones'],
  divider: ['divider', 'dividers'],
  pageBreak: ['page break', 'page breaks'],
  look: ['look', 'looks'],
};

/** The answer's lines for a suggested write (docs/specs/024-agents/pages-for-agents.md "Suggestions"). */
export function suggestedWriteLines(write: SuggestedWrite, title: string): string[] {
  const lines = [
    write.suggested
      ? `Suggested ${write.suggested} edit${write.suggested === 1 ? '' : 's'} to the article "${title}": they wait for review in the editor.`
      : `Suggested no edits to the article "${title}": its text already reads that way.`,
  ];
  if (write.direct.size) {
    const parts = [...write.direct].map(([what, n]) => {
      const [one, many] = DIRECT_WORDS[what] ?? [what, `${what}s`];
      return `${n} ${n === 1 ? one : many}`;
    });
    lines.push(`Written straight in, with no suggestion form: ${parts.join(', ')}.`);
  }
  if (write.kept)
    lines.push(
      `Left ${write.kept} block${write.kept === 1 ? '' : 's'} holding others' suggestions as ${write.kept === 1 ? 'it is' : 'they are'}: they wait for review.`,
    );
  if (write.tooLong)
    lines.push(
      `Left ${write.tooLong} paragraph${write.tooLong === 1 ? '' : 's'} as ${write.tooLong === 1 ? 'it is' : 'they are'}: with the suggested words kept beside the old, ${write.tooLong === 1 ? 'it' : 'they'} would pass a paragraph's ${MAX_ARTICLE_BLOCK_TEXT.toLocaleString('en')} characters. Split ${write.tooLong === 1 ? 'it' : 'them'} first.`,
    );
  return lines;
}
