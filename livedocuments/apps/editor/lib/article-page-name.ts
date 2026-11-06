// The name an unnamed article page or flashcard goes by (docs/specs/007-editor/pages-mode.md "Page names"): its
// article's own title, so naming a card is writing its title. Never stored on the page: the name keeps following the
// title as it changes, and a name typed in the page's panel still wins.
import { articleTitleOf, type ArticleFlow } from '@livedocuments/document';

// articleTitleOf's stand-in for an article with no title or heading: no name, the page keeps its place's.
const UNTITLED = 'Untitled';

/** The article's own title, or none while it has no title or heading. */
export function articleOwnTitle(flow: ArticleFlow | undefined): string | undefined {
  if (!flow) return undefined;
  const title = articleTitleOf(flow).trim();
  return title && title !== UNTITLED ? title : undefined;
}

/** Each article's own title by its flow id, read once per change of the articles (not per page, per render). */
export function articleTitlesOf(
  flows: Readonly<Record<string, ArticleFlow>> | undefined,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  if (!flows) return out;
  for (const [id, flow] of Object.entries(flows)) {
    const title = articleOwnTitle(flow);
    if (title) out.set(id, title);
  }
  return out;
}

/** The name a page shows: its own, else (on an article page or a card) its article's title, else none. */
export function shownPageName(
  page: { name?: string | undefined; flow?: string | undefined },
  titles: ReadonlyMap<string, string>,
): string | undefined {
  return page.name?.trim() || (page.flow ? titles.get(page.flow) : undefined);
}
