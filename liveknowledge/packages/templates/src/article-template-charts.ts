// Charts in the written templates (docs/specs/008-canvas/canvas-and-palette.md "Written documents", Work Tracker
// 1177): a figure the document charts rather than tabulates, as an object zone in the writing holding a native chart.
// The writing says where a chart goes with a line of its own, `{chart:<key>}`, read here into a zone block; the chart
// is an element of the tab, put in that zone where it first stands. A template cannot know where the writing will lay
// the zone out (that takes the fonts and the pages), so each zone first stands on the article's first page, one below
// the other, with its chart inside it; the editor settles the zones where the writing puts them on the first open by
// anyone who may edit (useArticles, an absent writer's settle), and each chart moves with its zone. Pure.
import {
  ARTICLE_TOP_MIN_PX,
  articleHeaderBandPx,
  articleMarginPx,
  createShape,
  layOutPages,
  type ArticleBlock,
  type ArticleStyle,
  type ArticleZoneBlock,
  type ShapeElement,
} from '@liveknowledge/document';
import { articlePage } from './article-template';

/** A chart a written template carries: its kind and data, and how tall its zone is. */
export type ArticleTemplateChart = {
  shape: 'bar-chart' | 'line-chart' | 'pie-chart';
  height: number;
  // The chart's own fields: its slices, or its categories and series, and its legend and values.
  fields: Partial<ShapeElement>;
};

const MARKER = /^\{chart:([a-z0-9-]+)\}$/;
// Between two zones as they first stand, so neither's chart is taken for the other's.
const FIRST_STAND_GAP = 24;

/** The chart key a block marks, or null: a paragraph of one line `{chart:<key>}` and nothing else. */
export function chartMarkerOf(block: ArticleBlock): string | null {
  if (block.type !== 'paragraph' || block.style) return null;
  if (block.runs.length !== 1) return null;
  return MARKER.exec(block.runs[0]!.text.trim())?.[1] ?? null;
}

/**
 * A written template's charts: each `{chart:<key>}` line of its blocks read into an inline object zone the width of
 * the text, standing on the first page (see above), and the chart that fills it. A marker with no chart of its key is
 * left as written, so a typo shows rather than vanishing.
 */
export function withTemplateCharts(
  flow: string,
  style: ArticleStyle | undefined,
  blocks: readonly ArticleBlock[],
  charts: Readonly<Record<string, ArticleTemplateChart>>,
): { blocks: ArticleBlock[]; elements: ShapeElement[] } {
  const page = layOutPages([articlePage(flow)])[0]!;
  const margin = Math.min(articleMarginPx(style), page.rect.width * 0.375);
  const width = Math.round(page.rect.width - 2 * margin);
  let y = Math.max(margin, ARTICLE_TOP_MIN_PX + articleHeaderBandPx(style));
  const elements: ShapeElement[] = [];
  const out = blocks.map((block): ArticleBlock => {
    const key = chartMarkerOf(block);
    const chart = key ? charts[key] : undefined;
    if (!key || !chart) return block;
    const zone: ArticleZoneBlock = {
      id: block.id,
      type: 'zone',
      zone: 'object',
      width,
      height: chart.height,
      at: { page: page.id, x: margin, y },
    };
    elements.push({
      ...createShape(chart.shape, Math.round(page.rect.x + margin), Math.round(page.rect.y + y)),
      width,
      height: chart.height,
      ...chart.fields,
    });
    y += chart.height + FIRST_STAND_GAP;
    return zone;
  });
  return { blocks: out, elements };
}
