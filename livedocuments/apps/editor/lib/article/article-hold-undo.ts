// An undo or redo around collaborators' holds (docs/specs/007-editor/article-pages.md "Holding a paragraph", "Undo
// and redo"): the step this person takes back never writes over a block someone else is writing in. Each held block
// (a held cell's whole table) keeps the words its writer has, as the present has them, and the rest of the step
// undoes as usual. Pure: the tabs before and after the step, and who holds what, in; the tabs to keep out.
import {
  articlesOf,
  withArticleFlow,
  type ArticleBlock,
  type ArticleFlow,
  type Tab,
} from '@livedocuments/document';

/** The blocks of one article that collaborators hold (ids of top-level blocks). */
export type HeldIn = (tabId: string, flow: string) => ReadonlySet<string>;

const sameBlock = (a: ArticleBlock, b: ArticleBlock): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

// `onto`'s blocks with each held block as `from` has it: replaced in place, or put back after the nearest block before
// it that `onto` keeps (else first). `onto` itself when nothing differs.
function keepHeldBlocks(
  from: readonly ArticleBlock[],
  onto: readonly ArticleBlock[],
  held: ReadonlySet<string>,
): readonly ArticleBlock[] {
  let out: ArticleBlock[] | null = null;
  for (let i = 0; i < from.length; i += 1) {
    const block = from[i]!;
    if (!held.has(block.id)) continue;
    const blocks: readonly ArticleBlock[] = out ?? onto;
    const at = blocks.findIndex((b) => b.id === block.id);
    if (at >= 0 && sameBlock(blocks[at]!, block)) continue;
    const next: ArticleBlock[] = out ?? onto.slice();
    out = next;
    if (at >= 0) {
      next[at] = block;
      continue;
    }
    // Gone from the snapshot: back after the nearest block before it that the snapshot keeps.
    let after = -1;
    for (let j = i - 1; j >= 0 && after < 0; j -= 1) {
      const id = from[j]!.id;
      after = next.findIndex((b) => b.id === id);
    }
    next.splice(after + 1, 0, block);
  }
  return out ?? onto;
}

/** `onto` (the tabs an undo or redo restores) with every block collaborators hold in `from` (the tabs now) kept as
 *  `from` has it. `onto` itself when nothing is held or nothing held would change. An article `onto` has no more
 *  (the step undoes its adding) stays gone. */
export function keepHeldWriting(from: readonly Tab[], onto: Tab[], heldIn: HeldIn): Tab[] {
  let out: Tab[] | null = null;
  for (let t = 0; t < onto.length; t += 1) {
    const tab = onto[t]!;
    const now = from.find((x) => x.id === tab.id);
    if (!now) continue;
    let kept = tab;
    for (const [flow, doc] of Object.entries(articlesOf(tab))) {
      // Who holds what is asked first: with nobody holding, the present's writing is never read.
      const held = heldIn(tab.id, flow);
      if (held.size === 0) continue;
      const was = articlesOf(now)[flow];
      if (!was) continue;
      const blocks = keepHeldBlocks(was.blocks, doc.blocks, held);
      if (blocks === doc.blocks) continue;
      const next: ArticleFlow = { ...doc, blocks: blocks as ArticleBlock[] };
      kept = withArticleFlow(kept, flow, next);
    }
    if (kept === tab) continue;
    out ??= onto.slice();
    out[t] = kept;
  }
  return out ?? onto;
}
