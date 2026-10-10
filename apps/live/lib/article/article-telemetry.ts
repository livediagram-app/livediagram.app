// The writing's block-insert telemetry (docs/specs/007-editor/article-pages.md "Telemetry"): one
// event per block put in, whether from the page toolbar's Insert or the slash menu, so both
// count the same. Object inserts (an image, a chart, a drawing) are counted by the host as they
// land (useArticles insertObject).
import type { SlashAction } from './article-slash-items';

export const ARTICLE_BLOCK_INSERT_EVENT = {
  divider: 'ArticleDivider',
  pageBreak: 'ArticlePageBreak',
  quote: 'ArticleQuote',
  code: 'ArticleCode',
} as const;

export type ArticleBlockInsert = keyof typeof ARTICLE_BLOCK_INSERT_EVENT;

/** The block-insert event a slash-menu choice counts as, or null (a text style, a list, or an
 *  object insert, which its host counts). */
export function slashInsertEvent(
  action: SlashAction,
): (typeof ARTICLE_BLOCK_INSERT_EVENT)[ArticleBlockInsert] | null {
  if (action.kind === 'block') return ARTICLE_BLOCK_INSERT_EVENT[action.block];
  if (action.kind === 'style' && (action.style === 'quote' || action.style === 'code'))
    return ARTICLE_BLOCK_INSERT_EVENT[action.style];
  return null;
}
