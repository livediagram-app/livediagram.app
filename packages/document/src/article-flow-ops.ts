// An article's writing changing, block by block (docs/specs/007-editor/article-pages.md
// "Collaboration"): the changes between two versions of one flow as id-addressed ops, and applying
// them, so two people writing in different blocks of the same article merge instead of one
// overwriting the other. The same shape as the element ops (element-op.ts) for the same reason.
import {
  sameArticleValue,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleStyle,
} from './article-flow';

export type ArticleOp =
  // A block added, changed or moved: it goes after `after` (null: first), or failing that before
  // `before` (null: last), or failing both where it already was (else at the end).
  | { kind: 'put'; block: ArticleBlock; after: string | null; before: string | null }
  | { kind: 'remove'; id: string }
  // The article's style replaced (undefined: back to the defaults).
  | { kind: 'style'; style?: ArticleStyle };

/** Indexes (into `seq`) of one longest strictly increasing subsequence: O(n log n). */
function longestIncreasing(seq: readonly number[]): Set<number> {
  const tails: number[] = [];
  const prevOf = new Array<number>(seq.length).fill(-1);
  seq.forEach((v, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]!]! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prevOf[i] = tails[lo - 1]!;
    tails[lo] = i;
  });
  const out = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1]! : -1; i >= 0; i = prevOf[i]!) out.add(i);
  return out;
}

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
 *  does nothing). Never returns an empty article. */
export function applyArticleOps(
  flow: ArticleFlow | undefined,
  ops: readonly ArticleOp[],
): ArticleFlow {
  const blocks = [...(flow?.blocks ?? [])];
  let style = flow?.style;
  for (const op of ops) {
    if (op.kind === 'remove') {
      const i = blocks.findIndex((b) => b.id === op.id);
      if (i >= 0) blocks.splice(i, 1);
      continue;
    }
    if (op.kind === 'style') {
      style = op.style;
      continue;
    }
    const at = blocks.findIndex((b) => b.id === op.block.id);
    if (at >= 0) blocks.splice(at, 1);
    const afterAt = op.after === null ? -1 : blocks.findIndex((b) => b.id === op.after);
    if (op.after === null || afterAt >= 0) {
      blocks.splice(afterAt + 1, 0, op.block);
      continue;
    }
    const beforeAt =
      op.before === null ? blocks.length : blocks.findIndex((b) => b.id === op.before);
    if (beforeAt >= 0) {
      blocks.splice(beforeAt, 0, op.block);
      continue;
    }
    blocks.splice(at >= 0 ? at : blocks.length, 0, op.block);
  }
  if (blocks.length === 0) blocks.push({ id: 'b-empty', type: 'paragraph', runs: [] });
  return style ? { blocks, style } : { blocks };
}
