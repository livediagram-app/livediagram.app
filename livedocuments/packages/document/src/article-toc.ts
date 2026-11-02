// An article's table of contents (docs/specs/007-editor/article-pages.md "Table of contents"): the
// headings it lists, drawn from the writing, never stored. Pure.
import type { ArticleRun } from './article-flow';

/** How many heading levels a contents block lists: Heading 1 only, 1 and 2, or 1 to 3. */
export type ArticleTocDepth = 1 | 2 | 3;

export type ArticleTocBlock = {
  id: string;
  type: 'toc';
  // Absent is 3 (Heading 1 to Heading 3).
  depth?: 1 | 2;
};

/** One line of a contents block: the heading's block id, its level (1 to 3) and its plain text. */
export type ArticleTocEntry = { id: string; level: 1 | 2 | 3; text: string };

const LEVEL: Readonly<Record<string, 1 | 2 | 3>> = { h1: 1, h2: 2, h3: 3 };

/** A contents block's depth, absent read as 3. */
export const tocDepthOf = (block: { depth?: unknown }): ArticleTocDepth =>
  block.depth === 1 || block.depth === 2 ? block.depth : 3;

/** The headings a contents block of `depth` lists, in order: Heading 1 to `depth`, their text plain,
 *  empty headings left out. The title and subtitle are never listed. */
export function articleTocEntries(
  blocks: readonly { id: string; type: string; style?: string; runs?: readonly ArticleRun[] }[],
  depth: ArticleTocDepth = 3,
): ArticleTocEntry[] {
  const out: ArticleTocEntry[] = [];
  for (const b of blocks) {
    if (b.type !== 'paragraph' || !b.style) continue;
    const level = LEVEL[b.style];
    if (!level || level > depth) continue;
    const text = (b.runs ?? [])
      .map((r) => r.text)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) out.push({ id: b.id, level, text });
  }
  return out;
}
