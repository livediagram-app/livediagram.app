// What a commit writes around our paragraph hold (docs/specs/007-editor/article-pages.md "Holding a paragraph"):
// while the room has not answered our claim on a block, that block commits as it was, so a claim the room gives to
// someone else never wrote over their words; and when it does give it to them, the block goes back to how it was.
import type { ArticleBlock } from '@livedocuments/document';

/** `blocks` with block `blockId` as `committed` has it; `committed` itself when nothing else differs, and `blocks`
 *  when that block is new or unchanged. */
export function heldBackBlocks(
  blocks: ArticleBlock[],
  committed: ArticleBlock[],
  blockId: string | null,
): ArticleBlock[] {
  if (blockId === null) return blocks;
  const was = committed.find((b) => b.id === blockId);
  const at = blocks.findIndex((b) => b.id === blockId);
  if (!was || at < 0 || blocks[at] === was) return blocks;
  const next = blocks.slice();
  next[at] = was;
  return next.length === committed.length && next.every((b, i) => b === committed[i])
    ? committed
    : next;
}
