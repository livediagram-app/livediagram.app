// A Word document's blocks and stored pictures built into an article tab
// (docs/specs/020-import-export/blueprints/office-import.md "buildArticleTab"). Each picture becomes an in-line object
// zone holding an image element. Where the writing puts a zone is only known once the editor lays it out, so each
// zone is parked (D66): its `at` set to a slot of its own left of the first page, its image exactly there. The
// editor's first layout (withZonesSettled) then moves every zone to its place, and its image with it.

import {
  ARTICLE_ZONE_MAX,
  ARTICLE_ZONE_MIN,
  articleMarginPx,
  layOutPages,
  nextArticleBlockId,
  nextArticleFlowId,
  nextPageId,
  pageDimensions,
  pagesOf,
  withArticleFlow,
  withPageKindChosen,
  type ArticleBlock,
  type Element,
  type ImageElement,
  type Tab,
} from '@livedocuments/document';
import type { DocxBlock, OfficePicture } from './docx';
import type { PictureOutcome } from './store-images';
import { zipKey } from './zip';

// A picture with no size anywhere: a modest landscape box the owner can resize.
const FALLBACK_W = 320;
const FALLBACK_H = 240;
// Parking slots: clear of the page and of each other (a zone is at most ARTICLE_ZONE_MAX on a side).
const PARK_X = -(ARTICLE_ZONE_MAX + 400);
const PARK_PITCH = ARTICLE_ZONE_MAX + 200;

const clampSide = (v: number) =>
  Math.round(Math.min(ARTICLE_ZONE_MAX, Math.max(ARTICLE_ZONE_MIN, v)));

/** The box a picture takes in the writing: its own size (else the stored image's), scaled as one so it fits the
 *  text area (`textWidth` x `textHeight`) and a zone's largest side, and grown, as far as that allows, to a zone's
 *  least side; only a picture too thin for both keeps a side clamped. */
export function pictureZoneSize(
  picture: OfficePicture,
  outcome: PictureOutcome | undefined,
  textWidth: number,
  textHeight: number = ARTICLE_ZONE_MAX,
): { width: number; height: number } {
  const stored = outcome && outcome !== 'over-cap' && outcome.ok ? outcome : undefined;
  let w = picture.widthPx;
  let h = picture.heightPx;
  if (!(w > 0 && h > 0)) {
    w = stored?.width ?? FALLBACK_W;
    h = stored?.height ?? FALLBACK_H;
  }
  const most = Math.min(
    textWidth / w,
    Math.min(textHeight, ARTICLE_ZONE_MAX) / h,
    ARTICLE_ZONE_MAX / w,
  );
  const scale = Math.max(Math.min(1, most), Math.min(most, ARTICLE_ZONE_MIN / Math.min(w, h)));
  return { width: clampSide(w * scale), height: clampSide(h * scale) };
}

/** The image element a picture becomes: its stored id, or an empty placeholder when it was not stored. */
export function pictureElement(
  picture: OfficePicture,
  outcome: PictureOutcome | undefined,
  box: { x: number; y: number; width: number; height: number },
): ImageElement {
  const stored = outcome && outcome !== 'over-cap' && outcome.ok ? outcome : undefined;
  return {
    id: crypto.randomUUID(),
    type: 'image',
    ...box,
    imageId: stored?.imageId ?? null,
    ...(stored ? { naturalWidth: stored.width, naturalHeight: stored.height } : {}),
    ...(picture.cropped ? { objectFit: 'cover' as const } : {}),
    ...(picture.alt ? { alt: picture.alt } : {}),
    aspectLocked: true,
  };
}

export function buildArticleTab(
  blocks: readonly DocxBlock[],
  outcomes: ReadonlyMap<string, PictureOutcome>,
  tabName: string,
): Tab {
  const flow = nextArticleFlowId();
  const blank: Tab = {
    id: crypto.randomUUID(),
    name: tabName.trim() || 'Imported',
    elements: [],
    // A fresh page id, so nothing that named the tab's old pages finds this one.
    pages: [{ id: nextPageId([]), orientation: 'portrait' }],
    templateChosen: true,
  };
  const chosen = withPageKindChosen(blank, pagesOf(blank)[0]!.id, 'article', flow)!;
  const page = layOutPages(pagesOf(chosen))[0]!;
  const textWidth = pageDimensions(page).width - 2 * articleMarginPx(undefined);
  const textHeight = pageDimensions(page).height - 2 * articleMarginPx(undefined);

  const elements: Element[] = [];
  const out: ArticleBlock[] = [];
  let slot = 0;
  for (const b of blocks) {
    if (b.type !== 'picture') {
      out.push(b);
      continue;
    }
    const outcome = outcomes.get(zipKey(b.picture.path));
    const size = pictureZoneSize(b.picture, outcome, textWidth, textHeight);
    const at = { page: page.id, x: PARK_X, y: slot * PARK_PITCH };
    slot += 1;
    out.push({ id: b.id, type: 'zone', zone: 'object', ...size, at });
    elements.push(
      pictureElement(b.picture, outcome, {
        x: page.rect.x + at.x,
        y: page.rect.y + at.y,
        ...size,
      }),
    );
  }
  // An article always has a block to write in.
  if (out.length === 0) out.push({ id: nextArticleBlockId(), type: 'paragraph', runs: [] });
  return { ...withArticleFlow(chosen, flow, { blocks: out }), elements };
}
