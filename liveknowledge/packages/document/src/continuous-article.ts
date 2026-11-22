// An article that arrives on paper becomes one continuous page (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "The continuous page"; docs/specs/030-knowledgebase/page-surface.md "No paper, no canvas"). A knowledgebase page is
// one article on one continuous page, but a tab made elsewhere can carry its article on paper sheets: a Word
// import, a livedocuments file, an agent's or a script's write, an older stored tab. Where a tab is settled on its
// way in (./stored-tab), such a tab reads as the same article on one continuous page, sized to its writing by the
// estimator, so nothing downstream draws a sheet. The editor's first layout then measures the real height.
import { isRecord } from '@liveworkspace/model-core/is-record';
import { withArticleHeightEstimated } from './continuous-page-estimate';
import { continuousPage } from './knowledgebase-page';
import { isContinuousPage } from './page-sizes';
import type { Page } from './page';
import type { Tab } from './index';

/**
 * The tab with its one article on one continuous page. The same tab back when it has no pages, is already so, or
 * is not one article's alone (pages of several articles, or a slide among them: nothing here can say which page the
 * knowledgebase's page is). Its other pages go: they were sheets of the same writing, which stays whole in its flow.
 */
export function withArticleContinuous<T extends object>(tab: T): T {
  const pages = (tab as { pages?: unknown }).pages;
  if (!Array.isArray(pages) || pages.length === 0 || !pages.every(isRecord)) return tab;
  const first = pages[0] as unknown as Page;
  const flow = first.flow;
  if (typeof flow !== 'string' || !flow) return tab;
  const sheets = pages as unknown as Page[];
  if (!sheets.every((p) => p.kind === 'article' && p.flow === flow)) return tab;
  if (sheets.length === 1 && isContinuousPage(first)) return tab;
  // The first sheet's identity (its id, so links to the page still land), on the continuous page's width; a paper
  // size's height is not the writing's, so the height starts at the least and is then estimated.
  const { size: _size, fit: _fit, ...kept } = first;
  void _size;
  void _fit;
  const one = { ...tab, pages: [continuousPage(kept as Page)] };
  return withArticleHeightEstimated(
    one as unknown as Pick<Tab, 'pages' | 'elements' | 'articles'>,
    flow,
  ) as unknown as T;
}
