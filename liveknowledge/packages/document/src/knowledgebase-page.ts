// A knowledgebase page (docs/specs/030-knowledgebase/knowledgebases-and-pages.md): one tab holding exactly one article
// on one page. The page a new knowledgebase opens with, the page every New Page makes, and how a tab stored without
// one (an empty tab from before, or from outside) is read as one.
import { articlesOf, newArticleFlow, type ArticleFlow } from './article-flow';
import { pagesOf, type Page } from './page';
import {
  CONTINUOUS_PAGE_MIN_HEIGHT,
  CONTINUOUS_PAGE_WIDTH,
  continuousPageHeight,
  isContinuousPage,
} from './page-sizes';
import type { Tab } from './tab-type';

/** The page a new knowledgebase opens with. */
export const START_PAGE_NAME = 'Start Here';
/** What a page is called until its title is written. */
export const NEW_PAGE_NAME = 'Untitled Page';

// A knowledgebase page's writing: the tab holds no other, so a fixed flow id cannot collide.
export const KNOWLEDGEBASE_FLOW = 'art-1';
const KNOWLEDGEBASE_PAGE_ID = 'page-1';

/** A knowledgebase page's one page, holding `flow`. */
export function knowledgebasePage(flow: string = KNOWLEDGEBASE_FLOW): Page {
  return continuousPage({
    id: KNOWLEDGEBASE_PAGE_ID,
    orientation: 'portrait',
    kind: 'article',
    flow,
  });
}

/** A page as a continuous page (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page"):
 *  portrait, in the fit size at the continuous width, its height the one it had as a continuous page, else the least. */
export function continuousPage<P extends Page>(page: P): P {
  const height = page.size === 'fit' && page.fit ? page.fit.height : CONTINUOUS_PAGE_MIN_HEIGHT;
  return {
    ...page,
    orientation: 'portrait',
    size: 'fit',
    fit: { width: CONTINUOUS_PAGE_WIDTH, height: continuousPageHeight(height) },
  };
}

/** The tab with its article's continuous page as tall as its writing needs (`needed` canvas px, from the page's top
 *  to the foot of its bottom margin): where the article engine would add a paper page, this page grows, and where it
 *  would remove one, it shrinks. The same tab back when the height is unchanged, the page is not continuous, or the
 *  article is not there: a layout that moves no line writes nothing. */
export function withArticlePageHeight<T extends Pick<Tab, 'pages'>>(
  tab: T,
  flow: string,
  needed: number,
): T {
  const pages = pagesOf(tab);
  const height = continuousPageHeight(needed);
  const page = pages.find((p) => p.flow === flow);
  if (!page || !isContinuousPage(page) || page.fit?.height === height) return tab;
  return {
    ...tab,
    pages: pages.map((p) =>
      p === page ? { ...p, fit: { width: CONTINUOUS_PAGE_WIDTH, height } } : p,
    ),
  };
}

/** The pages and writing of a new knowledgebase page: one page, an empty Title and a first paragraph. */
export function newKnowledgebasePageContent(): {
  pages: Page[];
  articles: Record<string, ArticleFlow>;
} {
  return { pages: [knowledgebasePage()], articles: { [KNOWLEDGEBASE_FLOW]: newArticleFlow() } };
}

/** Whether a name is one a page was given before anyone named it: its title may still name it. */
export function isDefaultPageName(name: string): boolean {
  const n = name.trim();
  return n === '' || n === START_PAGE_NAME || n === NEW_PAGE_NAME || /^Tab \d+$/.test(n);
}

/** Whether the tab is a knowledgebase page already: it has writing on a page of its own. */
export function isKnowledgebasePage(tab: Pick<Tab, 'pages' | 'articles'>): boolean {
  const flows = articlesOf(tab);
  return pagesOf(tab).some((p) => p.kind === 'article' && !!p.flow && !!flows[p.flow]);
}

/** A tab with nothing on it and no page of a kind (an empty tab made outside the editor) read as a new knowledgebase
 *  page; any other tab as it is. */
export function withKnowledgebasePage<T extends Pick<Tab, 'elements' | 'pages' | 'articles'>>(
  tab: T,
): T {
  if (tab.elements.length > 0) return tab;
  const pages = pagesOf(tab);
  if (pages.length !== 1 || pages[0]!.kind) return tab;
  return { ...tab, ...newKnowledgebasePageContent() };
}
