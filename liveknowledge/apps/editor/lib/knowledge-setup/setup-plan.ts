// The ticked pages of a suggestion as the plan the Import write path writes (docs/specs/030-knowledgebase/
// describe-to-set-up.md "The flow", step 3; lib/knowledge-import/write-plan.ts): each page its title, its one line
// as an italic first paragraph and its headings. Everything a suggestion holds is untrusted text from a model, so
// it reaches the page as words alone: each line is escaped before it is Markdown, and the Markdown reader the
// write path uses keeps no HTML and nothing that runs.
import { nextArticleBlockId, type ArticleBlock, type Tab } from '@liveknowledge/document';
import type { ImportPlan, PlannedPage } from '@liveknowledge/knowledge-import';
import { titleOf, type ReviewPage } from './setup-tree';

// One line with nothing Markdown reads as a mark, a link, a picture or the start of a list, a heading or a quote.
// Angle brackets are left as they are: the article's reader knows no HTML, so a tag is the characters it was.
export const plainLine = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\`*_[\](){}#~|!])/g, '\\$1')
    .replace(/^([-+>]|\d+[.)])/, '\\$1');

/** A page's Markdown: the summary in italics, then each heading. */
export function setupPageMarkdown(page: Pick<ReviewPage, 'summary' | 'headings'>): string {
  const summary = plainLine(page.summary);
  return [
    ...(summary ? [`*${summary}*`] : []),
    ...page.headings
      .map(plainLine)
      .filter(Boolean)
      .map((heading) => `# ${heading}`),
  ].join('\n\n');
}

/** The plan for the ticked pages, in tree order. A page whose parent is not ticked cannot be here (unticking a
 *  page unticks its subpages); were one to be, it lands at the top of the structure. */
export function setupPlan(pages: readonly ReviewPage[]): ImportPlan {
  const kept = new Set(pages.map((page) => page.id));
  const planned: PlannedPage[] = pages.map((page) => ({
    key: page.id,
    title: titleOf(page),
    parentKey: page.parent !== null && kept.has(page.parent) ? page.parent : null,
    markdown: setupPageMarkdown(page),
    links: [],
    pictures: [],
    attachments: [],
    warnings: [],
  }));
  return {
    pages: planned,
    // What the Import dialog reads of a plan; the write path reads the pages alone.
    summary: {
      source: 'markdown-folder',
      pages: planned.length,
      pictures: 0,
      attachments: 0,
      skipped: [],
      ignoredFiles: 0,
      blocked: null,
    },
  };
}

const isHeading = (block: ArticleBlock): boolean =>
  block.type === 'paragraph' && /^h[1-3]$/.test(block.style ?? '');

/** The page with an empty paragraph under each heading, to write in (Markdown has no way to say one). */
export function withRoomUnderHeadings(tab: Tab): Tab {
  if (!tab.articles) return tab;
  const articles: NonNullable<Tab['articles']> = {};
  for (const [flow, article] of Object.entries(tab.articles)) {
    const ids = new Set(article.blocks.map((block) => block.id));
    const blocks: ArticleBlock[] = [];
    article.blocks.forEach((block, at) => {
      blocks.push(block);
      const next = article.blocks[at + 1];
      // Nothing is added where writing already follows the heading.
      if (!isHeading(block) || (next && !isHeading(next))) return;
      const id = nextArticleBlockId(ids);
      ids.add(id);
      blocks.push({ id, type: 'paragraph', runs: [] });
    });
    articles[flow] = { ...article, blocks };
  }
  return { ...tab, articles };
}
