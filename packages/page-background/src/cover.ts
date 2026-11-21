// A cover: the band across the top of a liveplanner form (liveplanner docs/specs/030-forms/forms.md "Cover") and of a
// liveknowledge page (liveknowledge docs/specs/030-knowledgebase/page-surface.md "The cover"). A colour background
// (a fill and/or a pattern), a picture, or a pattern over a picture. One shape and one reader for both, so a cover
// means the same everywhere it is stored. Pure.
import { parseColourBackground, type ColourBackground } from './index';

/** `imageId` a picture of the item's, `focus` where it sits vertically (0 top to 100 bottom, 50 when absent),
 *  `credit` an Image Search pick's credit line. */
export type PageCover = ColourBackground & {
  imageId?: string;
  focus?: number;
  credit?: string;
};

/** Where a picture sits when nobody moved it: its middle. */
export const COVER_FOCUS_CENTRE = 50;
/** The longest credit line kept. */
export const COVER_CREDIT_MAX = 300;

const isFocus = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100;

/**
 * A stored cover, keeping what is valid: its colour background, and a picture whose id the caller's rule takes
 * (each product names its pictures its own way) with its focus and credit. Undefined when nothing is left.
 */
export function parsePageCover(
  v: unknown,
  isImageId: (id: unknown) => boolean,
): PageCover | undefined {
  const cover: PageCover = { ...parseColourBackground(v) };
  const raw = v as Record<string, unknown> | null;
  if (raw && typeof raw === 'object' && typeof raw.imageId === 'string' && isImageId(raw.imageId)) {
    cover.imageId = raw.imageId;
    if (isFocus(raw.focus) && raw.focus !== COVER_FOCUS_CENTRE) cover.focus = raw.focus;
    const credit =
      typeof raw.credit === 'string' ? raw.credit.trim().slice(0, COVER_CREDIT_MAX) : '';
    if (credit) cover.credit = credit;
  }
  return cover.fill || cover.pattern || cover.imageId ? cover : undefined;
}

/** The cover with a patch laid over it (a background's, or its picture's); none once it holds no fill, pattern or
 *  picture. A picture's focus and credit go with it, and a centred focus is not kept. */
export function patchPageCover(
  cover: PageCover | undefined,
  patch: Partial<PageCover>,
): PageCover | undefined {
  const merged = { ...cover, ...patch };
  const next: PageCover = {
    ...(merged.fill ? { fill: merged.fill } : {}),
    ...(merged.pattern ? { pattern: merged.pattern } : {}),
    ...(merged.imageId
      ? {
          imageId: merged.imageId,
          ...(merged.focus !== undefined && merged.focus !== COVER_FOCUS_CENTRE
            ? { focus: merged.focus }
            : {}),
          ...(merged.credit ? { credit: merged.credit } : {}),
        }
      : {}),
  };
  return next.fill || next.pattern || next.imageId ? next : undefined;
}

/** The CSS `object-position` a picture is drawn at: across the middle, down by its focus. */
export function coverObjectPosition(focus: number | undefined): string {
  return `50% ${isFocus(focus) ? focus : COVER_FOCUS_CENTRE}%`;
}

/** A focus moved by `by` percent and held inside the picture: what a drag or an arrow key gives. */
export function movedCoverFocus(focus: number | undefined, by: number): number {
  const from = isFocus(focus) ? focus : COVER_FOCUS_CENTRE;
  return Math.max(0, Math.min(100, Math.round(from + by)));
}
