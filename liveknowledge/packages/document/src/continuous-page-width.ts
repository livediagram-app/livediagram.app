// A continuous page stored at another width (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Pages stored at
// the first width"; blueprint continuous-page.md): a knowledgebase page written before Work Tracker 1418 was 856 px
// wide, a 760 px column. It is read at the continuous width wherever a stored tab is settled (./stored-tab), with no
// editor needed: its left edge stays put (page-layout.ts), its height and its zones move by what the estimator says
// the wider column changes, its zones' elements with them, and its margin notes out to the new right margin. The
// editor's first full-width layout then settles all of it as measured. Pure: the page is stored at the new width
// with the next save of the tab.
import { isRecord } from '@liveworkspace/model-core/is-record';
import { articlesOf, type ArticleZoneBlock } from '@liveworkspace/article/article-flow';
import { estimateArticle } from './article-layout-estimate';
import { articleMarginPx } from './article-style';
import { withElementsMoved, withZonesSettled } from './article-zones';
import { layOutPages, pagesOf, type LaidOutPage, type Page } from './page';
import { CONTINUOUS_PAGE_WIDTH, continuousPageHeight, isContinuousPage } from './page-sizes';
import type { Tab } from './index';

type WidthTab = Pick<Tab, 'pages' | 'elements' | 'articles'>;

/** The width a continuous article page was stored at, when it is a finite width other than the continuous one. */
function storedWidthOf(page: unknown): number | null {
  if (!isRecord(page) || page.kind !== 'article' || page.size !== 'fit' || !isRecord(page.fit))
    return null;
  const w = page.fit.width;
  return typeof w === 'number' && Number.isFinite(w) && w > 0 && w !== CONTINUOUS_PAGE_WIDTH
    ? w
    : null;
}

/** How far across a zone moves when the column widens by `delta`: by its alignment in the column. */
function acrossOf(zone: ArticleZoneBlock, delta: number): number {
  const side = zone.wrap && zone.wrap !== 'inline' ? zone.wrap : (zone.align ?? 'center');
  return side === 'left' ? 0 : side === 'right' ? delta : delta / 2;
}

/**
 * The tab with its one continuous page read at the continuous width, when it was stored at another: its height, its
 * zones (and their elements) and its margin notes moved by what the wider column changes. The same tab back for any
 * other tab (no pages, several, not a continuous article page, or one at the continuous width already).
 */
export function withContinuousPageWidth<T extends object>(tab: T): T {
  const raw = (tab as { pages?: unknown }).pages;
  if (!Array.isArray(raw) || raw.length !== 1) return tab;
  const was = storedWidthOf(raw[0]);
  if (was === null) return tab;
  const t = tab as unknown as WidthTab;
  const read = pagesOf(t)[0];
  if (!read?.fit || !isContinuousPage(read) || !Array.isArray(t.elements)) return tab;
  const storedHeight = read.fit.height;
  const widen = (height: number): Page => ({
    ...(raw[0] as Page),
    fit: { width: CONTINUOUS_PAGE_WIDTH, height },
  });
  const flow = read.flow;
  const doc = flow ? articlesOf(t)[flow] : undefined;
  if (!flow || !doc) return { ...tab, pages: [widen(storedHeight)] };

  // The writing estimated at both widths: only the difference is used, so the estimator's own bias cancels out.
  const laidNow = layOutPages([read])[0]!;
  const laidWas: LaidOutPage = {
    ...laidNow,
    fit: { width: was, height: storedHeight },
    rect: { ...laidNow.rect, width: was },
  };
  const before = estimateArticle(t, flow, [laidWas], '#000000');
  const after = estimateArticle(t, flow, [laidNow], '#000000');
  const height =
    before.height !== undefined && after.height !== undefined
      ? continuousPageHeight(storedHeight + after.height - before.height)
      : storedHeight;
  const widened = { ...t, pages: [widen(height)] };

  // Each zone across by its share of the wider column and down by the estimated move of its top, its elements with
  // it (withZonesSettled reads them where the zone stands now: the left edge did not move).
  const delta = CONTINUOUS_PAGE_WIDTH - was;
  const zones = doc.blocks.flatMap((b) => {
    if (b.type !== 'zone' || !b.at || b.at.page !== read.id) return [];
    const top = before.zoneTops?.get(b.id);
    const now = after.zoneTops?.get(b.id);
    const down = top !== undefined && now !== undefined ? Math.round(now - top) : 0;
    return [{ id: b.id, index: 0, x: b.at.x + acrossOf(b, delta), y: b.at.y + down }];
  });
  const settled = withZonesSettled(widened, flow, zones);

  // Margin notes that stood in the first width's right margin, out to the new one.
  const margin = articleMarginPx(doc.style);
  const oldRight = laidNow.rect.x + was;
  const notes = new Set<string>();
  for (const el of settled.elements) {
    if (el.type !== 'article-note') continue;
    const centre = el.x + el.width / 2;
    if (centre >= oldRight - margin && centre <= oldRight) notes.add(el.id);
  }
  const elements = withElementsMoved(settled.elements, notes, delta, 0);
  return (elements === settled.elements ? settled : { ...settled, elements }) as unknown as T;
}
