// The plain text of a page's writing, block by block: what search indexes, what Ask quotes and what the context
// budget measures. Markdown is `articleToMarkdown`'s job (@liveknowledge/document); this is the words alone, with no
// syntax to match by accident and no renderer of its own.
import {
  articleRunsText,
  articleTableText,
  type ArticleBlock,
  type ArticleFlow,
} from '@liveknowledge/document';

/** A block's text as read: its runs (footnote references left out), a code block's code, a table's cells. Blocks
 *  that hold no words (a divider, a page break, a contents block, a zone) answer ''. */
export function blockText(block: ArticleBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'list':
      return articleRunsText(block.runs);
    case 'code':
      return block.text;
    case 'table':
      return articleTableText(block);
    default:
      return '';
  }
}

/** A page's writing as plain text, a block a line, blocks without words left out. */
export function writingText(flow: Pick<ArticleFlow, 'blocks'>): string {
  const lines: string[] = [];
  for (const block of flow.blocks) {
    const text = blockText(block).trim();
    if (text) lines.push(text);
  }
  return lines.join('\n');
}
