import { isUntitledName } from '@livedocuments/api-schema';
import { articlesOf, truncateName, type ArticleBlock, type Tab } from '@livedocuments/document';

/**
 * The name an article's Title gives its document (docs/specs/006-document/document.md "Naming"): while the
 * document still has a blank's default name, the Title of an article on its first tab names it, as the first label
 * does for the canvas. Null when nothing names it: another name, an article elsewhere, or no Title typed yet.
 */
export function articleTitleName(
  documentName: string,
  firstTab: Tab | undefined,
  flow: string,
  blocks: readonly ArticleBlock[],
): string | null {
  if (!isUntitledName(documentName) || !firstTab || !articlesOf(firstTab)[flow]) return null;
  const title = blocks.find((b) => b.type === 'paragraph' && b.style === 'title');
  if (!title || title.type !== 'paragraph') return null;
  const name = truncateName(title.runs.map((r) => r.text).join(''));
  return name || null;
}
