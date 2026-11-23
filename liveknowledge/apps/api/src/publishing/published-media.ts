// What a published page shows beyond its words (docs/specs/030-knowledgebase/publishing.md "Pictures on the public
// site"; blueprint publishing.md P31 to P33, P35): each zone of its saved writing drawn as a figure of the elements
// standing in it, its cover, and the pictures those place, kept to the ones the knowledgebase may serve. The figures
// are drawn when the page is drawn (published-snapshot.ts), never per read, and a picture's address names the site
// alone, so the public picture route (public-media.ts) asks the snapshot, and only the snapshot, whether it is placed
// on a published page (published-reads.ts servesPublishedPicture).
import { imageRefIds } from '@liveworkspace/api-kit/image-refs';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import {
  coverFill,
  coverObjectPosition,
  coverThemeFrom,
  getBuiltInTheme,
  imageAltTextOf,
  isArticleHex,
  knowledgeWritingAccent,
  laidOutPagesOf,
  migrateStoredTab,
  parseTabCover,
  renderElementsToSvg,
  savedArticlesOf,
  tabInKnowledgeStyle,
  zoneCanvasRect,
  zoneMemberIds,
  type ArticleZoneBlock,
  type Element,
  type KnowledgeStyle,
  type LaidOutPage,
  type PageRect,
  type Tab,
} from '@liveknowledge/document';
import { escapeHtml, type ZoneFigure } from '@liveknowledge/knowledge';
import { servableImageIds } from '../db/image-grants';
import { pageFlowOf } from '../knowledge/page-read';
import type { DocumentEnv } from '../types';

/** A published picture's path: under its site, never naming the knowledgebase or its owner. */
export const publishedMediaPath = (site: string, imageId: string): string =>
  `/kb/${site}/media/${encodeURIComponent(imageId)}`;

// A zone of the page's saved writing, where it stood and what stands in it. A zone never laid out holds nothing.
type ZoneAt = { rect: PageRect; members: Element[] };

/** What a page places in its writing and its cover, read once for both the candidates and the drawing. */
export type PageObjects = { tab: Tab; zones: Map<string, ZoneAt>; coverImage: string | null };

export function pageObjectsOf(stored: Tab): PageObjects {
  const zones = new Map<string, ZoneAt>();
  const flow = pageFlowOf(stored);
  const blocks = flow ? (savedArticlesOf(stored)[flow]?.blocks ?? []) : [];
  // Settled as every drawing of a stored tab is (thumbnail.ts), only for a page that places something.
  let tab = stored;
  let pages: LaidOutPage[] | null = null;
  for (const b of blocks) {
    if (b.type !== 'zone') continue;
    if (!pages) {
      tab = migrateStoredTab({ ...stored, elements: stored.elements ?? [] });
      pages = laidOutPagesOf(tab);
    }
    const rect = zoneCanvasRect(pages, b);
    if (!rect) continue;
    const ids = zoneMemberIds(tab.elements, rect);
    if (ids.size === 0) continue;
    zones.set(b.id, { rect, members: tab.elements.filter((el) => ids.has(el.id)) });
  }
  const cover = parseTabCover((stored as { cover?: unknown }).cover);
  const coverImage = cover && 'imageId' in cover ? (imageRefIds([], [], cover)[0] ?? null) : null;
  return { tab, zones, coverImage };
}

/** The gallery pictures a page could make public: its zones' and its cover's. */
export function candidatePictures(objects: PageObjects): string[] {
  const ids = new Set<string>();
  for (const zone of objects.zones.values())
    for (const id of imageRefIds(zone.members)) ids.add(id);
  if (objects.coverImage) ids.add(objects.coverImage);
  return [...ids];
}

/** The pictures of a batch of pages the knowledgebase may serve: one query for all of them. */
export async function servablePictures(
  env: DocumentEnv,
  documentId: string,
  pages: readonly PageObjects[],
): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const page of pages) for (const id of candidatePictures(page)) ids.add(id);
  return servableImageIds(env, documentId, [...ids]);
}

/** A page's figures, cover and the pictures they place, as the site draws them (P31 to P33). */
export type PageFigures = { figure: ZoneFigure; cover: string; media: Set<string> };

type Look = { site: string; style: KnowledgeStyle };

const KIND_OF = (zone: ArticleZoneBlock, members: readonly Element[]): string =>
  zone.zone === 'drawing'
    ? 'drawing'
    : members.every((el) => el.type === 'image')
      ? 'picture'
      : 'object';

export function pageFigures(
  objects: PageObjects,
  look: Look,
  servable: ReadonlySet<string>,
): PageFigures {
  const media = new Set<string>();
  const href = (id: string): string | undefined => {
    if (!servable.has(id)) return undefined;
    media.add(id);
    return publishedMediaPath(look.site, id);
  };
  // In the knowledgebase's style, as its readers see the page (thumbnail.ts draws its preview the same way).
  let styled: Tab | null = null;
  const figure: ZoneFigure = (zone) => {
    const at = objects.zones.get(zone.id);
    if (!at) return null;
    styled ??= tabInKnowledgeStyle(objects.tab, look.style);
    const ids = new Set(at.members.map((el) => el.id));
    const { rect } = at;
    const svg = renderElementsToSvg(styled, {
      // Framed to the zone, on no paper of its own: the page's ground shows through, and a drawing's ink is a light
      // page's (P31), so the dark appearance gives it a white card (publish-site-css.ts).
      frame: {
        bounds: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        surface: 'light',
        backgroundSvg: '',
        reaches: (el) => ids.has(el.id),
      },
      resolveImageHref: href,
      resolveIconArt: resolveIconExportArt,
      resolveStickerArt,
    });
    const alt = imageAltTextOf(objects.tab.elements, ids);
    const named = alt ? `role="img" aria-label="${escapeHtml(alt)}"` : 'aria-hidden="true"';
    const kind = KIND_OF(zone, at.members);
    const wrap = zone.wrap === 'left' || zone.wrap === 'right' ? ` wrap-${zone.wrap}` : '';
    const align = zone.align === 'left' || zone.align === 'right' ? zone.align : 'center';
    return `<figure class="zone zone-${kind} align-${align}${wrap}" style="max-width:${Math.round(rect.width)}px">${svg.replace('<svg ', `<svg ${named} `)}</figure>`;
  };
  return { figure, cover: coverHtml(objects, look, href), media };
}

// The cover band (P33): a picture the knowledgebase may serve, or a gradient in its style; nothing else.
function coverHtml(
  objects: PageObjects,
  look: Look,
  href: (id: string) => string | undefined,
): string {
  const cover = parseTabCover((objects.tab as { cover?: unknown }).cover);
  if (!cover) return '';
  if ('imageId' in cover) {
    const src = objects.coverImage ? href(objects.coverImage) : undefined;
    if (!src) return '';
    const credit = cover.credit ? `<span class="credit">${escapeHtml(cover.credit)}</span>` : '';
    return `<div class="cover"><img src="${escapeHtml(src)}" alt="" style="object-position:${coverObjectPosition(cover.focus)}" decoding="async" fetchpriority="high">${credit}</div>`;
  }
  const theme = coverThemeFrom(
    getBuiltInTheme(look.style.theme, 'light'),
    knowledgeWritingAccent(look.style),
  );
  const fill = coverFill(cover, theme);
  // An animated cover is its gradient, still: the public site runs no script. Every theme gradient and motion is a
  // gradient of hex colours (page-theme-fills.ts); only colours this module can vouch for are written into the style.
  if (
    fill?.kind !== 'gradient' ||
    !isArticleHex(fill.from) ||
    !isArticleHex(fill.to) ||
    !Number.isFinite(fill.angle)
  )
    return '';
  return `<div class="cover" style="background:linear-gradient(${Math.round(fill.angle)}deg, ${fill.from}, ${fill.to})"></div>`;
}
