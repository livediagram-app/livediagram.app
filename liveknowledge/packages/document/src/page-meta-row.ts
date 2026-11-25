// The meta row under a knowledgebase page's Title (docs/specs/030-knowledgebase/verification.md "The meta row"): the
// room the editor's writing gives it (app/article-pages.css .article-page-slot-meta, which reads these through the
// --page-meta-* variables article-style-vars.ts sets), so a layout without a browser (article-layout-estimate.ts)
// leaves the same room. Pure.
import type { ArticleBlock } from '@liveworkspace/article/article-flow';

/** The meta row's room in the writing, canvas px: its margins (collapsing with the blocks' own) and its height. */
export const PAGE_META_ROW = { above: 8, height: 28, below: 20 } as const;

const hasWords = (text: string) => /\S/.test(text);
const runsWords = (runs: readonly { text: string }[]) => runs.some((r) => hasWords(r.text));

/**
 * Whether the writing draws the meta row: under a Title block that starts it, on a page with any words, which always
 * shows its reading time (PageMetaRow). An empty page's row has nothing to say and takes no room.
 */
export function drawsPageMetaRow(blocks: readonly ArticleBlock[]): boolean {
  const first = blocks[0];
  if (first?.type !== 'paragraph' || first.style !== 'title') return false;
  return blocks.some((b) =>
    b.type === 'paragraph' || b.type === 'list'
      ? runsWords(b.runs)
      : b.type === 'code'
        ? hasWords(b.text)
        : b.type === 'table' && b.rows.some((row) => row.cells.some(runsWords)),
  );
}
