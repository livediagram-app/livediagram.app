// An article's writing changing, block by block (docs/specs/007-editor/article-pages.md
// "Collaboration"): the changes between two versions of one flow as id-addressed ops, and applying
// them, so two people writing in different blocks of the same article merge instead of one
// overwriting the other. The same shape as the element ops (element-op.ts) for the same reason.
import {
  isArticleId,
  normaliseRuns,
  parseArticleBlock,
  parseArticleStyle,
  sameArticleValue,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleStyle,
} from '@liveworkspace/article/article-flow';
import {
  MAX_ARTICLE_CELL_RUNS,
  MAX_ARTICLE_CELL_TEXT,
  tableCellOps,
  withTableCell,
  type ArticleTableCellOp,
} from '@liveworkspace/article/article-table';
import { longestIncreasing } from '@liveworkspace/model-core/id-list-steps';

export type ArticleOp =
  // A block added or moved: it goes after `after` (null: first), or failing that before `before`
  // (null: last), or failing both where it already was (else at the end). A block that only
  // changed, in its place, carries neither: it is replaced where it stands on the receiver, so a
  // collaborator's block added beside it keeps its own place (else at the end, when missing).
  | { kind: 'put'; block: ArticleBlock; after?: string | null; before?: string | null }
  | { kind: 'remove'; id: string }
  // The article's style replaced (undefined: back to the defaults).
  | { kind: 'style'; style?: ArticleStyle }
  // One table cell's text replaced (docs/specs/007-editor/article-pages.md "Collaboration": a table
  // syncs cell by cell), by its table's, row's and column's ids.
  | ArticleTableCellOp;

/** The ops that turn `before` into `after` (`before` absent: an article arriving whole). Removals
 *  first, then a put for each block that is new, changed, or moved (not among the most blocks
 *  that kept their order), in `after`'s order, then the style. A block that merely has a new
 *  neighbour is not sent again, so its text cannot overwrite a collaborator's edit to it. */
export function diffArticleFlow(before: ArticleFlow | undefined, after: ArticleFlow): ArticleOp[] {
  const ops: ArticleOp[] = [];
  const prevBlocks = before?.blocks ?? [];
  const prevIndex = new Map(prevBlocks.map((b, i) => [b.id, i] as const));
  const nextIds = new Set(after.blocks.map((b) => b.id));
  for (const b of prevBlocks) if (!nextIds.has(b.id)) ops.push({ kind: 'remove', id: b.id });
  // The blocks present in both, in their new order, by their old place: those in the longest
  // increasing run kept their order; the rest moved.
  const keptPositions: number[] = [];
  const keptAt: number[] = [];
  after.blocks.forEach((b, i) => {
    const was = prevIndex.get(b.id);
    if (was === undefined) return;
    keptPositions.push(was);
    keptAt.push(i);
  });
  const stayed = new Set([...longestIncreasing(keptPositions)].map((k) => keptAt[k]!));
  after.blocks.forEach((b, i) => {
    const was = prevIndex.get(b.id);
    if (was !== undefined && stayed.has(i)) {
      const old = prevBlocks[was]!;
      if (old === b || sameArticleValue(old, b)) return;
      // A table whose cells alone changed goes cell by cell, so a collaborator's cell keeps its text.
      const cells = old.type === 'table' && b.type === 'table' ? tableCellOps(old, b) : null;
      if (cells) ops.push(...cells);
      else ops.push({ kind: 'put', block: b });
      return;
    }
    ops.push({
      kind: 'put',
      block: b,
      after: i > 0 ? after.blocks[i - 1]!.id : null,
      before: i < after.blocks.length - 1 ? after.blocks[i + 1]!.id : null,
    });
  });
  if (!sameArticleValue(before?.style, after.style))
    ops.push({ kind: 'style', style: after.style });
  return ops;
}

/** `ops` applied to `flow` (absent: an article arriving for the first time, built from its puts).
 *  An op naming a block that is not there is applied as best it can (a remove of a missing block
 *  does nothing). Never returns an empty article. Linear: the blocks are a list linked by id while
 *  the ops apply, so an article arriving whole, or rewritten whole, never rescans itself per op. */
export function applyArticleOps(
  flow: ArticleFlow | undefined,
  ops: readonly ArticleOp[],
): ArticleFlow {
  const list = new BlockList(flow?.blocks ?? []);
  let style = flow?.style;
  for (const op of ops) {
    if (op.kind === 'remove') {
      list.remove(op.id);
      continue;
    }
    if (op.kind === 'style') {
      style = op.style;
      continue;
    }
    if (op.kind === 'cell') {
      // A cell whose table, row or column has gone changes nothing: a change of shape won.
      const table = list.get(op.block);
      if (table?.type === 'table') list.replace(withTableCell(table, op.row, op.col, op.runs));
      continue;
    }
    const id = op.block.id;
    if (op.after === undefined && op.before === undefined) {
      if (list.has(id)) list.replace(op.block);
      else list.insertBefore(op.block, null);
      continue;
    }
    // Where it was: before the block that followed it (the end when none did, or when it was not there).
    const was = list.has(id) ? list.remove(id) : null;
    if (op.after === null) list.insertAfter(op.block, null);
    else if (op.after !== undefined && list.has(op.after)) list.insertAfter(op.block, op.after);
    else if (op.before === null || op.before === undefined) list.insertBefore(op.block, null);
    else if (list.has(op.before)) list.insertBefore(op.block, op.before);
    else list.insertBefore(op.block, was);
  }
  const blocks = list.toArray();
  if (blocks.length === 0) blocks.push({ id: 'b-empty', type: 'paragraph', runs: [] });
  return style ? { blocks, style } : { blocks };
}

/** An article's blocks as a list linked by id, for applyArticleOps: every lookup, removal and
 *  insertion O(1). Its blocks' ids are unique (parseArticleFlow keeps the first of a repeat, and no
 *  op adds a second): a repeat given here is kept as a block of its own no op can name. */
class BlockList {
  private readonly byId = new Map<string, ArticleBlock>();
  private readonly prev = new Map<string, string | null>();
  private readonly next = new Map<string, string | null>();
  private head: string | null = null;
  private tail: string | null = null;
  // Repeated ids, kept where they stood (after the block of that id, or first): they never take an op.
  private readonly repeats: { after: string | null; block: ArticleBlock }[] = [];

  constructor(blocks: readonly ArticleBlock[]) {
    for (const b of blocks) {
      if (this.byId.has(b.id)) this.repeats.push({ after: this.tail, block: b });
      else this.insertBefore(b, null);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): ArticleBlock | undefined {
    return this.byId.get(id);
  }

  /** A block put in the place of the block with its id. */
  replace(block: ArticleBlock): void {
    this.byId.set(block.id, block);
  }

  /** The block with `id` taken out; answers the id of the block that followed it (null: it was last). */
  remove(id: string): string | null {
    if (!this.byId.has(id)) return null;
    const before = this.prev.get(id)!;
    const after = this.next.get(id)!;
    if (before === null) this.head = after;
    else this.next.set(before, after);
    if (after === null) this.tail = before;
    else this.prev.set(after, before);
    this.byId.delete(id);
    this.prev.delete(id);
    this.next.delete(id);
    return after;
  }

  /** `block` (its id not in the list) put before the block `at` (null: at the end). */
  insertBefore(block: ArticleBlock, at: string | null): void {
    const before = at === null ? this.tail : this.prev.get(at)!;
    this.link(block, before, at);
  }

  /** `block` (its id not in the list) put after the block `at` (null: first). */
  insertAfter(block: ArticleBlock, at: string | null): void {
    const after = at === null ? this.head : this.next.get(at)!;
    this.link(block, at, after);
  }

  private link(block: ArticleBlock, before: string | null, after: string | null): void {
    const id = block.id;
    this.byId.set(id, block);
    this.prev.set(id, before);
    this.next.set(id, after);
    if (before === null) this.head = id;
    else this.next.set(before, id);
    if (after === null) this.tail = id;
    else this.prev.set(after, id);
  }

  toArray(): ArticleBlock[] {
    const out: ArticleBlock[] = [];
    const repeatsAfter = new Map<string | null, ArticleBlock[]>();
    for (const r of this.repeats) {
      const at = r.after !== null && this.byId.has(r.after) ? r.after : null;
      const kept = repeatsAfter.get(at);
      if (kept) kept.push(r.block);
      else repeatsAfter.set(at, [r.block]);
    }
    out.push(...(repeatsAfter.get(null) ?? []));
    for (let id = this.head; id !== null; id = this.next.get(id)!) {
      out.push(this.byId.get(id)!);
      const kept = repeatsAfter.get(id);
      if (kept) out.push(...kept);
    }
    return out;
  }
}

const placeOf = (v: unknown): string | null | undefined | false =>
  v === undefined || v === null ? v : isArticleId(v) ? v : false;

/** A peer's ops read defensively (docs/specs/007-editor/article-pages.md "Collaboration"): each
 *  block parsed as a stored one, ids bounded, anything malformed dropped; null when `v` is not a
 *  list at all. What a receiver applies, never the wire value itself. */
export function parseArticleOps(v: unknown): ArticleOp[] | null {
  if (!Array.isArray(v)) return null;
  const out: ArticleOp[] = [];
  for (const raw of v as unknown[]) {
    const o = raw as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') continue;
    if (o.kind === 'remove' && isArticleId(o.id)) out.push({ kind: 'remove', id: o.id });
    else if (o.kind === 'cell') {
      if (!isArticleId(o.block) || !isArticleId(o.row) || !isArticleId(o.col)) continue;
      out.push({
        kind: 'cell',
        block: o.block,
        row: o.row,
        col: o.col,
        runs: normaliseRuns(o.runs, MAX_ARTICLE_CELL_TEXT, MAX_ARTICLE_CELL_RUNS),
      });
    } else if (o.kind === 'style') {
      const style = parseArticleStyle(o.style);
      out.push(style ? { kind: 'style', style } : { kind: 'style' });
    } else if (o.kind === 'put') {
      const block = parseArticleBlock(o.block);
      const after = placeOf(o.after);
      const before = placeOf(o.before);
      if (!block || after === false || before === false) continue;
      out.push({
        kind: 'put',
        block,
        ...(after !== undefined ? { after } : {}),
        ...(before !== undefined ? { before } : {}),
      });
    }
  }
  return out;
}
