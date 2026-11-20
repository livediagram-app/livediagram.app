// A page's title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"): the Title block of its
// writing. The page's name follows it: typing in the Title renames the page, and renaming the page in the tree
// rewrites the Title. Pure: a tab in, its title or a new tab out.
import {
  articleRunsText,
  articlesOf,
  pagesOf,
  truncateName,
  withArticleFlow,
  type ArticleBlock,
  type ArticleParagraphBlock,
  type Tab,
} from '@liveknowledge/document';

const isTitle = (block: ArticleBlock): block is ArticleParagraphBlock =>
  block.type === 'paragraph' && block.style === 'title';

/** The flow of the page's writing: its first article page's. Undefined for a tab whose writing is not held here. */
export function pageFlowOf(tab: Tab): string | undefined {
  const flows = articlesOf(tab);
  for (const page of pagesOf(tab)) {
    if (page.kind === 'article' && page.flow && flows[page.flow]) return page.flow;
  }
  return undefined;
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
