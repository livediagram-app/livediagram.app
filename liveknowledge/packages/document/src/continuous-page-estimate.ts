// A continuous page's height where there is no browser to lay its writing out (an agent's write on the server, a
// preview): estimated by the layout estimator, so the page is about as tall as its writing before any editor opens
// it. The editor that next lays it out settles the real height (docs/specs/030-knowledgebase/blueprints/
// continuous-page.md "Behaviour and state").
import { estimateArticle } from './article-layout-estimate';
import { withArticlePageHeight } from './knowledgebase-page';
import { layOutPages, pagesOf } from './page';
import { isContinuousPage } from './page-sizes';
import type { Tab } from './tab-type';

/** The tab with `flow`'s continuous page as tall as its writing is estimated to need; the same tab back when the
 *  article is not on a continuous page, or the height is already that. */
export function withArticleHeightEstimated<T extends Pick<Tab, 'pages' | 'elements' | 'articles'>>(
  tab: T,
  flow: string,
): T {
  const laid = layOutPages(pagesOf(tab));
  const own = laid.find((p) => p.flow === flow);
  if (!own || !isContinuousPage(own)) return tab;
  const { height } = estimateArticle(tab, flow, laid, '#000000');
  return height === undefined ? tab : withArticlePageHeight(tab, flow, height);
}
