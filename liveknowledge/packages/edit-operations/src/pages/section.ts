// An append's place and picture (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The section"; this app's
// docs/specs/013-workspace/send-to-knowledge.md): where the blocks written under a heading go, and the picture placed
// after them, as an object zone holding an image element. Where the writing puts a zone is only known once the editor
// lays it out, so the zone is made parked as an import's pictures are (office-import build-article.ts), its image
// exactly there, and once the writing is in, placed where the layout estimate puts it on a continuous page
// (withPictureZonePlaced), so a Viewer reads it in place before any Editor lays the page out. Pure.
import type { ArticleWritePicture } from '@liveknowledge/api-schema';
import {
  ARTICLE_LINE_HEIGHT,
  ARTICLE_TEXT_SIZE_PX,
  ARTICLE_ZONE_MAX,
  ARTICLE_ZONE_MIN,
  articleMarginPx,
  articlesOf,
  estimateArticle,
  isContinuousPage,
  layOutPages,
  nextArticleBlockId,
  pageDimensions,
  pagesOf,
  resolveArticleStyle,
  withZonesSettled,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleZoneBlock,
  type Element,
  type ImageElement,
  type Tab,
} from '@liveknowledge/document';

const HEADING_LEVEL = { h1: 1, h2: 2, h3: 3 } as const;

/** A block's heading level, 1 to 3; null for any other block. */
export function headingLevel(block: ArticleBlock): 1 | 2 | 3 | null {
  if (block.type !== 'paragraph' || !block.style) return null;
  return block.style in HEADING_LEVEL
    ? HEADING_LEVEL[block.style as keyof typeof HEADING_LEVEL]
    : null;
}

/** A block's words, as the person reads them. */
export const blockText = (block: ArticleBlock): string =>
  'runs' in block ? block.runs.map((r) => r.text).join('') : '';

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The line a write's Markdown marks its picture's place with: `[picture]` on a line of its own. */
export const PICTURE_MARK = '[picture]';

/** Whether a written block is the picture's mark. */
export const isPictureMark = (block: ArticleBlock): boolean =>
  block.type === 'paragraph' && !block.style && blockText(block).trim() === PICTURE_MARK;

/** The article's headings, in order: what a picker offers to write under. */
export function articleHeadings(
  flow: ArticleFlow,
): { id: string; level: 1 | 2 | 3; text: string }[] {
  return flow.blocks.flatMap((b) => {
    const level = headingLevel(b);
    const text = blockText(b).trim();
    return level && text ? [{ id: b.id, level, text }] : [];
  });
}

/**
 * Where blocks written under `after` go: the index just past the end of that heading's part (before the next heading
 * of the same or a higher level, else the end). `after` is the heading's block id, else its words (the first heading
 * that reads so, case and spacing aside). Null when no heading matches.
 */
export function sectionEndOf(blocks: readonly ArticleBlock[], after: string): number | null {
  let at = blocks.findIndex((b) => b.id === after && headingLevel(b) !== null);
  if (at < 0) {
    const want = key(after);
    at = blocks.findIndex((b) => headingLevel(b) !== null && key(blockText(b)) === want);
  }
  if (at < 0) return null;
  const level = headingLevel(blocks[at]!)!;
  for (let i = at + 1; i < blocks.length; i++) {
    const next = headingLevel(blocks[i]!);
    if (next !== null && next <= level) return i;
  }
  return blocks.length;
}

// Parking: clear of the page and of each other (a zone is at most ARTICLE_ZONE_MAX on a side), as an import parks.
const PARK_X = -(ARTICLE_ZONE_MAX + 400);
const PARK_PITCH = ARTICLE_ZONE_MAX + 200;

const clampSide = (v: number) =>
  Math.round(Math.min(ARTICLE_ZONE_MAX, Math.max(ARTICLE_ZONE_MIN, v)));

/** The zone a picture takes: its own size, scaled down to the text's width and a zone's tallest, never grown. */
export function pictureZoneSize(
  picture: Pick<ArticleWritePicture, 'width' | 'height'>,
  textWidth: number,
): { width: number; height: number } {
  const scale = Math.min(1, textWidth / picture.width, ARTICLE_ZONE_MAX / picture.height);
  return { width: clampSide(picture.width * scale), height: clampSide(picture.height * scale) };
}

/**
 * The picture's zone block (to sit among the written blocks) and the tab with its image element added, parked beside
 * the article's first page in a slot no other zone of the article holds.
 */
export function pictureZone(
  tab: Tab,
  flow: string,
  doc: ArticleFlow,
  picture: ArticleWritePicture,
  ids: { block?: () => string; element?: () => string } = {},
): { zone: ArticleZoneBlock; tab: Tab } {
  const laid = layOutPages(pagesOf(tab));
  const page = laid.find((p) => p.flow === flow) ?? laid[0]!;
  const textWidth = pageDimensions(page).width - 2 * articleMarginPx(doc.style);
  const size = pictureZoneSize(picture, textWidth);
  const slot = doc.blocks.filter((b) => b.type === 'zone').length;
  const at = { page: page.id, x: PARK_X, y: slot * PARK_PITCH };
  const zone: ArticleZoneBlock = {
    id: ids.block?.() ?? nextArticleBlockId(),
    type: 'zone',
    zone: 'object',
    align: 'left',
    ...size,
    at,
  };
  const image: ImageElement = {
    id: ids.element?.() ?? crypto.randomUUID(),
    type: 'image',
    x: page.rect.x + at.x,
    y: page.rect.y + at.y,
    ...size,
    imageId: picture.imageId,
    naturalWidth: picture.width,
    naturalHeight: picture.height,
    ...(picture.alt ? { alt: picture.alt } : {}),
    aspectLocked: true,
  };
  const elements: Element[] = [...tab.elements, image];
  return { zone, tab: { ...tab, elements } };
}

// Below a zone the estimate leaves this many lines before the next block (article-layout-estimate.ts).
const ZONE_FOOT_LINES = 0.6;

/**
 * The tab with the zone `zoneId` of the article `flow` (and the picture in it) moved from its parking place to where
 * the writing puts it, as the layout estimate sets it: the continuous page's height for the writing up to and
 * including the zone, less the zone, the room under it and the bottom margin. A paper page, or a zone the article
 * does not hold, keeps its parking place for the editor's first layout to settle.
 */
export function withPictureZonePlaced(tab: Tab, flow: string, zoneId: string): Tab {
  const doc = articlesOf(tab)[flow];
  const index = doc?.blocks.findIndex((b) => b.id === zoneId) ?? -1;
  const zone = doc?.blocks[index];
  const laid = layOutPages(pagesOf(tab));
  const page = laid.find((p) => p.flow === flow);
  if (!doc || zone?.type !== 'zone' || !page || !isContinuousPage(page)) return tab;
  const upTo: ArticleFlow = { ...doc, blocks: doc.blocks.slice(0, index + 1) };
  const { height } = estimateArticle(
    { ...tab, articles: { ...tab.articles, [flow]: upTo } },
    flow,
    laid,
    '#000000',
  );
  const style = resolveArticleStyle(doc.style);
  const line = ARTICLE_TEXT_SIZE_PX[style.textSize] * ARTICLE_LINE_HEIGHT[style.lineSpacing];
  const margin = articleMarginPx(doc.style);
  // A continuous page's estimate always has its height.
  const y = Math.round(height! - margin - zone.height - ZONE_FOOT_LINES * line);
  return withZonesSettled(tab, flow, [{ id: zoneId, index: 0, x: margin, y }]);
}
