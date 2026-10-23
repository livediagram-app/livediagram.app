// A page painted with a picture (docs/specs/007-editor/pages-mode.md "Image backgrounds"):
// the fill's shape, how a stored one is read, the tone the page reads as under its overlay, and the
// gallery images a tab's pages name. Pure, shared by the editor, the exports, the api's image
// reference index and the agents' page summaries.
import { isImageCredit, type ImageCredit } from './image-credit';

// The overlays over the picture, under everything on the page.
export type PageImageOverlayKind = 'light' | 'dark' | 'tint' | 'fade';
const PAGE_IMAGE_OVERLAY_KINDS: readonly PageImageOverlayKind[] = ['light', 'dark', 'tint', 'fade'];
// `strength` is the overlay's opacity, 0 to PAGE_IMAGE_OVERLAY_MAX; `color` is a Tint's colour
// (the theme accent when it was chosen).
export type PageImageOverlay = { kind: PageImageOverlayKind; strength: number; color?: string };

// Which band of a taller picture stays when it is cropped to cover the page; absent is centre.
export type PageImagePosition = 'top' | 'bottom';
const PAGE_IMAGE_POSITIONS: readonly PageImagePosition[] = ['top', 'bottom'];

export type PageImageFill = {
  kind: 'image';
  // A gallery image id, or an Offline Mode design's base64 raster data URI; never a web address.
  imageId: string;
  // The picture's average colour, sampled once when picked; absent reads as mid grey.
  tone?: string;
  // Absent is no overlay.
  overlay?: PageImageOverlay;
  position?: PageImagePosition;
  // The search pick's credit (docs/specs/009-elements/image-search.md "Credit on the element").
  credit?: ImageCredit;
  // A hover preview's picture (an Openverse thumbnail, https): never stored, dropped on read.
  preview?: string;
};

// The most an overlay covers: always some picture shows through.
export const PAGE_IMAGE_OVERLAY_MAX = 0.9;
// A new picture's overlay strength: text stays readable whatever the picture.
const PAGE_IMAGE_DEFAULT_STRENGTH = 0.6;
// The washes' colours: white, and the dark paper's slate-900.
const PAGE_IMAGE_LIGHT = '#ffffff';
const PAGE_IMAGE_DARK = '#0f172a';
// What a picture whose tone could not be sampled reads as.
const PAGE_IMAGE_UNKNOWN_TONE = '#808080';
// A gallery id: a UUID today, capped as the api's reference index caps it.
const GALLERY_ID = /^[A-Za-z0-9_-]{1,128}$/;
// An Offline Mode embed: the raster types an upload can hold, base64.
const INLINE_RASTER = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const HEX = /^#[0-9a-f]{6}$/i;

/** Whether a stored `imageId` may name a page's picture: a gallery id or an inline raster. */
export function isPageImageId(v: unknown): v is string {
  return typeof v === 'string' && (GALLERY_ID.test(v) || INLINE_RASTER.test(v));
}

/** The overlay a page's picture takes, a new pick's default: a light wash on a light canvas, a
 *  dark one on a dark canvas. */
export function defaultPageImageOverlay(dark: boolean): PageImageOverlay {
  return { kind: dark ? 'dark' : 'light', strength: PAGE_IMAGE_DEFAULT_STRENGTH };
}

const clampStrength = (n: number) =>
  Math.round(Math.min(PAGE_IMAGE_OVERLAY_MAX, Math.max(0, n)) * 100) / 100;

function parseOverlay(v: unknown): PageImageOverlay | undefined {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return undefined;
  const kind = o.kind as PageImageOverlayKind;
  if (!PAGE_IMAGE_OVERLAY_KINDS.includes(kind)) return undefined;
  if (typeof o.strength !== 'number' || !Number.isFinite(o.strength)) return undefined;
  if (kind === 'tint' && !(typeof o.color === 'string' && HEX.test(o.color))) return undefined;
  return {
    kind,
    strength: clampStrength(o.strength),
    ...(kind === 'tint' ? { color: o.color as string } : {}),
  };
}

/** A stored image fill, or undefined when its picture is not one a page may name. Its optional
 *  fields keep what is valid and drop the rest (a preview is never kept). */
export function parsePageImageFill(f: Record<string, unknown>): PageImageFill | undefined {
  if (f.kind !== 'image' || !isPageImageId(f.imageId)) return undefined;
  const overlay = parseOverlay(f.overlay);
  const position = PAGE_IMAGE_POSITIONS.includes(f.position as PageImagePosition)
    ? (f.position as PageImagePosition)
    : undefined;
  return {
    kind: 'image',
    imageId: f.imageId,
    ...(typeof f.tone === 'string' && HEX.test(f.tone) ? { tone: f.tone } : {}),
    ...(overlay ? { overlay } : {}),
    ...(position ? { position } : {}),
    ...(isImageCredit(f.credit) ? { credit: f.credit } : {}),
  };
}

/** Whether two image fills paint the same (the picture, its overlay and its position). */
export function samePageImage(a: PageImageFill, b: PageImageFill): boolean {
  return (
    a.imageId === b.imageId &&
    a.preview === b.preview &&
    a.position === b.position &&
    a.overlay?.kind === b.overlay?.kind &&
    a.overlay?.strength === b.overlay?.strength &&
    a.overlay?.color === b.overlay?.color
  );
}

/** The colour an overlay washes toward. */
export function pageImageOverlayColor(overlay: PageImageOverlay): string {
  if (overlay.kind === 'dark') return PAGE_IMAGE_DARK;
  if (overlay.kind === 'tint') return overlay.color ?? PAGE_IMAGE_LIGHT;
  return PAGE_IMAGE_LIGHT;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `a` moved toward `b` by `t` (0 is `a`, 1 is `b`), as a hex colour. */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return (
    '#' +
    x
      .map((v, i) =>
        Math.round(v + (y[i]! - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** The colour a picture page reads as: its tone moved toward its overlay's colour by the overlay's
 *  strength (a Fade, clear at the top, by half of it). What its ink is chosen against. */
export function pageImageTone(fill: Pick<PageImageFill, 'tone' | 'overlay'>): string {
  const tone = fill.tone && HEX.test(fill.tone) ? fill.tone : PAGE_IMAGE_UNKNOWN_TONE;
  const o = fill.overlay;
  if (!o) return tone;
  return mixHex(tone, pageImageOverlayColor(o), o.kind === 'fade' ? o.strength / 2 : o.strength);
}

type RawPage = { background?: { fill?: { kind?: unknown; imageId?: unknown } } };

/** The pictures a tab's pages name, distinct, in page order (stored pages, unparsed: what the
 *  api indexes and the exports load). */
export function pageImageIds(pages: unknown): string[] {
  if (!Array.isArray(pages)) return [];
  const ids = new Set<string>();
  for (const p of pages as RawPage[]) {
    const fill = p && typeof p === 'object' ? p.background?.fill : undefined;
    if (fill && fill.kind === 'image' && isPageImageId(fill.imageId)) ids.add(fill.imageId);
  }
  return [...ids];
}

/** The pages with each picture's id swapped through `mapping` (ids it lacks kept): Offline Mode's
 *  re-homing. The same array when nothing changes. */
export function withPageImageIds<P extends { background?: { fill?: unknown } }>(
  pages: readonly P[] | undefined,
  mapping: ReadonlyMap<string, string>,
): readonly P[] | undefined {
  if (!pages || mapping.size === 0) return pages;
  let changed = false;
  const next = pages.map((p) => {
    const fill = p.background?.fill as PageImageFill | undefined;
    const to = fill?.kind === 'image' ? mapping.get(fill.imageId) : undefined;
    if (!fill || !to || to === fill.imageId) return p;
    changed = true;
    return { ...p, background: { ...p.background, fill: { ...fill, imageId: to } } };
  });
  return changed ? next : pages;
}
