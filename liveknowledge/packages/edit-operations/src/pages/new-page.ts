// A new knowledgebase page from Markdown (docs/specs/024-agents/knowledgebase-for-agents.md `create_page`): one
// continuous page whose writing opens with its title, built without a store so the api (a page added to a
// knowledgebase) and the MCP server (the pages a new knowledgebase starts with) make the same tab.
import { buildTab, newKnowledgebasePageContent, type Tab } from '@liveknowledge/document';
import type { PagesRefusal } from '@liveknowledge/api-schema';
import { applyArticleWrite } from './article-write';

export type NewPage = {
  id: string;
  title: string;
  /** The page's writing; empty leaves the new page's empty title and first paragraph. */
  markdown?: string;
  /** The id of the page it sits under; absent at the top level. */
  parent?: string;
};

// The title as the writing's front matter, so the page opens with it; Markdown that brings its own is kept. A title
// in quotes is quoted again and a `[^` escaped, as the Markdown writer does, so it reads back as it was given.
export function withTitleFrontMatter(title: string, markdown: string): string {
  if (/^---\s*\n/.test(markdown)) return markdown;
  const line = title.replace(/\s+/g, ' ').trim().replace(/\[\^/g, '\\[^');
  const value = /^(["']).*\1$/.test(line) ? (line[0] === '"' ? `'${line}'` : `"${line}"`) : line;
  return `---\ntitle: ${value}\n---\n\n${markdown}`;
}

/** The page as a tab, each `[[Title]]` in its Markdown a link to the page `links` finds; or why the Markdown was
 *  refused. */
export function newPageFromMarkdown(
  page: NewPage,
  links?: { pageByTitle: (title: string) => string | undefined },
): { tab: Tab } | { refusal: PagesRefusal } {
  const blank: Tab = {
    ...buildTab(page.id, page.title, [], undefined, undefined),
    templateChosen: true,
    ...newKnowledgebasePageContent(),
    ...(page.parent ? { parent: page.parent } : {}),
  };
  if (!page.markdown?.trim()) return { tab: blank };
  const written = applyArticleWrite(
    blank,
    { markdown: withTitleFrontMatter(page.title, page.markdown), mode: 'replace' },
    {},
    links,
  );
  return 'refusal' in written ? { refusal: written.refusal } : { tab: written.tab };
}
