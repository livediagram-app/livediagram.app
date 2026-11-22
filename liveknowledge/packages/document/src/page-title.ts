// A page's title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree", "Name"): the Title block
// of its writing. The Title is what the page is called; the tab's name is the copy kept so a page can be listed
// without loading its writing, and follows it (withNameFromTitle). Renaming the page rewrites the Title
// (withPageTitle). Shared by the editor and the api, so every way in keeps the two the same. Pure: a tab in, its
// title or a new tab out.
import { truncateName } from '@liveworkspace/model-core/names';
import { articleRunsText } from './article-footnotes';
import { articlesOf, type ArticleBlock, type ArticleParagraphBlock } from './article-flow';
import { withArticleFlow } from './article-pages';
import { pagesOf } from './page';
import { savedArticlesOf } from './page-draft';
import type { Tab } from './tab-type';

const isTitle = (block: ArticleBlock): block is ArticleParagraphBlock =>
  block.type === 'paragraph' && block.style === 'title';

/** The flow of the page's writing: its first article page's, or the tab's one article where no page names it (a
 *  page written before pages were stored). Undefined for a tab whose writing is not held here. Never the draft's
 *  (page-draft.ts): a page's title and name are its saved writing's. */
export function pageFlowOf(tab: Tab): string | undefined {
  const flows = savedArticlesOf(tab);
  for (const page of pagesOf(tab)) {
    if (page.kind === 'article' && page.flow && flows[page.flow]) return page.flow;
  }
  const keys = Object.keys(flows);
  return keys.length === 1 ? keys[0] : undefined;
}

/** The name a Title gives its page: its text, capped as every name is. Empty when there is no Title or it is blank. */
export function titleNameOf(blocks: readonly ArticleBlock[]): string {
  const title = blocks.find(isTitle);
  return title ? truncateName(articleRunsText(title.runs)) : '';
}

/** The page's title as its writing has it; empty with no writing held, no Title block, or a blank one. */
export function pageTitleOf(tab: Tab): string {
  const flow = pageFlowOf(tab);
  return flow ? titleNameOf(articlesOf(tab)[flow]!.blocks) : '';
}

/**
 * The tab with its Title rewritten to `name` (plain text: a rename keeps no bold or link inside the title). The same
 * tab when its writing is not held here, it has no Title block, or the Title already says so.
 */
export function withPageTitle(tab: Tab, name: string): Tab {
  const flow = pageFlowOf(tab);
  if (!flow) return tab;
  const doc = articlesOf(tab)[flow]!;
  const title = doc.blocks.find(isTitle);
  if (!title || articleRunsText(title.runs) === name) return tab;
  const blocks = doc.blocks.map((block) =>
    block === title ? { ...title, runs: name ? [{ text: name }] : [] } : block,
  );
  return withArticleFlow(tab, flow, { ...doc, blocks });
}

/**
 * `after` with its name following its Title, where the Title changed from `before`'s: the name is the Title's text,
 * empty (shown as "Untitled Page") when the Title was emptied. A page whose Title did not change keeps its name, so a
 * page whose Title was never written keeps the name it was made with (Start Here). The same tab when nothing moves.
 */
export function withNameFromTitle<T extends Tab>(before: Tab, after: T): T {
  if (!pageFlowOf(after)) return after;
  const title = pageTitleOf(after);
  if (title === pageTitleOf(before) || title === after.name) return after;
  return { ...after, name: title };
}
