// A template's writing read from Markdown (docs/specs/008-canvas/canvas-and-palette.md "Written documents"), as every
// written template is: the article's own Markdown reader, then the template's ids, title and subtitle, page breaks and
// table columns. Pure.
import { parseMarkdownBlocks, type ArticleBlock } from '@livedocuments/document';

/**
 * Markdown read into an article's blocks, as a template writes them: ids `b-<prefix>-<n>` in order, the first two
 * paragraphs the title and subtitle, a divider a page break, each table its column shares.
 */
export function markdownArticleBlocks(
  prefix: string,
  markdown: string,
  columns?: readonly (readonly number[])[],
): ArticleBlock[] {
  let table = 0;
  return parseMarkdownBlocks(markdown.trim()).map((block, i): ArticleBlock => {
    const id = `b-${prefix}-${i + 1}`;
    if (block.type === 'divider') return { id, type: 'pageBreak' };
    if (i < 2 && block.type === 'paragraph')
      return { ...block, id, style: i === 0 ? 'title' : 'subtitle' };
    if (block.type === 'table') {
      const shares = columns?.[table++];
      if (shares && shares.length === block.cols.length)
        return { ...block, id, cols: block.cols.map((c, n) => ({ ...c, w: shares[n]! })) };
    }
    return { ...block, id };
  });
}
