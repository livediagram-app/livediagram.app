// The pages Pages mode draws on the canvas (docs/specs/007-editor/pages-mode.md "The
// pages"): sheets in a row, each its own size
// (A4 unless it says otherwise), orientation, background and name. The first is centred on the
// row anchor (the canvas origin unless a page carries one) and each further one sits a gap to the right of the one before. The pages are the
// tab's (`Tab.pages`), so everyone lays out on the same ones; the sheets themselves are a view,
// never elements. A tab from before multiple pages carries one `pageOrientation` instead, read as
// a single page.
import { isBoxed, type Element, type Tab } from './index';
import {
  parsePageSides,
  parseRowAt,
  type PageSides,
  type RowAt,
} from '@liveworkspace/model-core/page-fit';
import {
  parseColourFill,
  parsePagePattern,
  type PageColourFill,
  type PagePattern,
} from '@liveworkspace/page-background';
import { parsePageImageFill, type PageImageFill } from './page-image';
import {
  DEFAULT_WIREFRAME_DEVICE,
  WIREFRAME_DEVICES,
  isWireframeDeviceId,
  isWireframeFrameLook,
  type WireframeDeviceId,
  type WireframeFrameLook,
} from './wireframe-device';
import {
  PHOTO_DEFAULT_HEIGHT,
  PHOTO_DEFAULT_WIDTH,
  PHOTO_SHEET_MAX,
} from '@livedesign/photo-engine';
import { cutText } from './text-cut';
import {
  LOGO_PAGE_SIZE_IDS,
  MAX_PAGES,
  PAGE_SIZES,
  PHOTO_PAGE_SIZE_IDS,
  type PageOrientation,
  type PageSizeId,
  UNCHOSEN_PAGE_SIZE_IDS,
  WIREFRAME_PAGE_SIZE_IDS,
  isPageSizeId,
  pageHasOrientation,
  pageSizeLabel,
} from './page-sizes';
import { layOutPages, rowPageAt } from './page-layout';

export {
  A4_LONG_SIDE,
  A4_SHORT_SIDE,
  LOGO_SAFE_FRACTION,
  LOGO_SIDE,
  MAX_PAGES,
  PAGE_GAP,
  PAGE_ORIENTATIONS,
  PAGE_SIZES,
  PAGE_SIZE_IDS,
  pageDimensions,
  pageHasOrientation,
  pageSizeLabel,
} from './page-sizes';
export type { PageOrientation, PageSizeId } from './page-sizes';
export { layOutPages, pageAt, pageFitBox, pageMargin, rowAnchorOf, rowPageAt } from './page-layout';

export function pageSizesFor(kind: PageKind | null): readonly PageSizeId[] {
  if (kind === 'logo') return LOGO_PAGE_SIZE_IDS;
  if (kind === 'wireframe') return WIREFRAME_PAGE_SIZE_IDS;
  if (kind === 'photo') return PHOTO_PAGE_SIZE_IDS;
  return UNCHOSEN_PAGE_SIZE_IDS;
}

/** The size tiles a page's panel shows: its kind's sizes (pageSizesFor), Fit to Content first on
 *  a page already in it. */
export function pageSizeChoices(
  page: Pick<Page, 'kind' | 'size' | 'orientation'>,
): readonly PageSizeId[] {
  const current = page.size ?? 'a4';
  let sizes = pageSizesFor(pageKindOf(page));
  // A page already in a size its kind no longer offers keeps that tile until it moves off it.
  if (current !== 'fit' && !sizes.includes(current)) sizes = [...sizes, current];
  return current === 'fit' ? ['fit', ...sizes] : sizes;
}

export {
  PAGE_MOTIONS,
  PAGE_MOTION_SPEED_MAX,
  PAGE_MOTION_SPEED_MIN,
  PAGE_PATTERNS,
  isPageMotion,
  type PageColourFill,
  type PageMotion,
  type PagePattern,
} from '@liveworkspace/page-background';
export type PageFill = PageColourFill | PageImageFill;
export type PageBackground = { fill?: PageFill; pattern?: PagePattern };

// The longest page name kept: a label, not a caption.
export const PAGE_NAME_MAX = 60;

// What a page is for, fixed once chosen (docs/specs/007-editor/pages-mode.md "Page kinds"): a
// logo's artboard, a wireframe's device (docs/specs/007-editor/wireframe-pages.md), or a photo to
// edit (docs/specs/031-photo/photo-pages.md).
export type PageKind = 'logo' | 'wireframe' | 'photo';

export type Page = {
  id: string;
  orientation: PageOrientation;
  // Absent is A4.
  size?: PageSizeId;
  // A Fit to Content page's own sides, whole canvas px; present exactly when `size` is 'fit'.
  fit?: PageSides;
  // The row anchor (docs/specs/007-editor/pages-mode.md "A page"): where the first page's
  // centre sits, whole canvas px. A property of the row, carried by one page (any one); absent on
  // every page is the canvas origin.
  rowAt?: RowAt;
  // Absent is the plain paper.
  background?: PageBackground;
  // Absent shows the page's place ("Page 2").
  name?: string;
  // Absent is a page nobody has chosen a kind for yet (the first page offers the choice while it
  // is the only page and empty); 'logo' for a logo's artboard, always the `logo` size and never
  // patterned; 'wireframe' for a device's screen; 'photo' for a photo, the `photo` size with its
  // sheet's sides in `fit`, never painted (its picture is `Tab.photos[id]`).
  kind?: PageKind;
  // Locked (docs/specs/007-editor/pages-mode.md "Locking a page"): it and what is on it stay
  // as they are. Absent is unlocked.
  locked?: true;
  // A wireframe page's device, frame look (absent is Dark) and system bars (absent is shown);
  // present only on wireframe pages, whose size is always 'device'.
  device?: WireframeDeviceId;
  frameLook?: WireframeFrameLook;
  systemBars?: false;
  // Started blank (Start From Scratch on its Start From a Layout card): the card is not offered on it
  // again; its panel's Layouts still are. Absent while it may be offered.
  startedBlank?: true;
};

export type PageRect = { x: number; y: number; width: number; height: number };

export type LaidOutPage = Page & { index: number; rect: PageRect };

// The id the first page of a tab that never stored its pages answers to.
const FIRST_PAGE_ID = 'page-1';

function isPageOrientation(v: unknown): v is PageOrientation {
  return v === 'portrait' || v === 'landscape';
}

function parseFill(v: unknown): PageFill | undefined {
  const f = v as Record<string, unknown> | null;
  if (f && typeof f === 'object' && f.kind === 'image') return parsePageImageFill(f);
  return parseColourFill(v);
}

function parseBackground(v: unknown): PageBackground | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return undefined;
  const fill = parseFill(b.fill);
  const pattern = parsePagePattern(b.pattern);
  if (!fill && !pattern) return undefined;
  return { ...(fill ? { fill } : {}), ...(pattern ? { pattern } : {}) };
}

/** A stored page, or undefined when it has no valid id or orientation. Its optional fields keep
 *  what is valid and drop the rest. */
function parsePage(v: unknown): Page | undefined {
  const page = parsePageFields(v);
  const rowAt = page && parseRowAt((v as Record<string, unknown>).rowAt);
  return page && rowAt ? { ...page, rowAt } : page;
}

function parsePageFields(v: unknown): Page | undefined {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !isPageOrientation(p.orientation))
    return undefined;
  const background = parseBackground(p.background);
  const name = typeof p.name === 'string' ? cutText(p.name.trim(), PAGE_NAME_MAX) : '';
  const lock = {
    ...(p.locked === true ? { locked: true as const } : {}),
    ...(p.startedBlank === true ? { startedBlank: true as const } : {}),
  };
  const kindFields =
    p.kind === 'logo'
      ? { kind: 'logo' as const }
      : p.kind === 'wireframe'
        ? { kind: 'wireframe' as const }
        : p.kind === 'photo'
          ? { kind: 'photo' as const }
          : {};
  // A logo page is the artboard, never patterned nor pictured (docs/specs/007-editor/logo-pages.md).
  if (kindFields.kind === 'logo') {
    const fill = background?.fill?.kind === 'image' ? undefined : background?.fill;
    return {
      id: p.id,
      orientation: 'portrait',
      size: 'logo',
      ...(fill ? { background: { fill } } : {}),
      ...(name ? { name } : {}),
      kind: 'logo',
      ...lock,
    };
  }
  // A wireframe page is its device: a device this build does not know is the iPhone, a turn on one
  // that does not turn is upright (docs/specs/007-editor/wireframe-pages.md "The devices").
  if (kindFields.kind === 'wireframe') {
    const device = isWireframeDeviceId(p.device) ? p.device : DEFAULT_WIREFRAME_DEVICE;
    const turns = WIREFRAME_DEVICES[device].turns;
    return {
      id: p.id,
      orientation: turns ? p.orientation : 'portrait',
      size: 'device',
      ...(background ? { background } : {}),
      ...(name ? { name } : {}),
      kind: 'wireframe',
      device,
      ...(isWireframeFrameLook(p.frameLook) && p.frameLook !== 'theme'
        ? { frameLook: p.frameLook }
        : {}),
      ...(p.systemBars === false ? { systemBars: false as const } : {}),
      ...lock,
    };
  }
  // A photo page is its picture's size, never painted (docs/specs/031-photo/photo-pages.md "A
  // photo page"): a stored one without valid sides is read as the default photo's sheet.
  if (kindFields.kind === 'photo') {
    const fit = parsePageSides(p.fit) ?? photoSheetSides(PHOTO_DEFAULT_WIDTH, PHOTO_DEFAULT_HEIGHT);
    return {
      id: p.id,
      orientation: fit.width >= fit.height ? 'landscape' : 'portrait',
      size: 'photo',
      fit,
      ...(name ? { name } : {}),
      kind: 'photo',
      ...lock,
    };
  }
  // A page not chosen yet is its sheet (A4), or Fit to Content with its sides.
  const fit = p.size === 'fit' ? parsePageSides(p.fit) : undefined;
  const ownSize =
    isPageSizeId(p.size) &&
    p.size !== 'a4' &&
    !PAGE_SIZES[p.size].logoOnly &&
    !PAGE_SIZES[p.size].deviceOnly &&
    !PAGE_SIZES[p.size].photoOnly &&
    (p.size !== 'fit' || fit !== undefined);
  return {
    id: p.id,
    orientation: p.orientation,
    ...(ownSize ? { size: p.size as PageSizeId } : {}),
    ...(ownSize && fit ? { fit } : {}),
    ...(background ? { background } : {}),
    ...(name ? { name } : {}),
    ...kindFields,
    ...lock,
  };
}

/** The page's kind: a logo, a wireframe or a photo page, or null for one whose kind is not chosen
 *  yet. */
export function pageKindOf(page: Pick<Page, 'kind'>): PageKind | null {
  return page.kind === 'logo' || page.kind === 'wireframe' || page.kind === 'photo'
    ? page.kind
    : null;
}

/** The tab's kind (docs/specs/007-editor/pages-mode.md "One kind a tab"): its first page's, so a
 *  logo tab holds only logo pages; null while the first page is blank (its kind not chosen), when no
 *  page of a kind may be added. A page added is of this kind. Reads the first page only. */
export function tabPageKind(pages: readonly Pick<Page, 'kind'>[]): PageKind | null {
  return pages[0] ? pageKindOf(pages[0]) : null;
}

/** The page the + adds another like: the last of the tab's kind (the last page, unless a tab
 *  stored before one kind a tab mixes kinds), or undefined on a tab with no kind yet. */
export function lastPageOfTabKind<P extends Pick<Page, 'kind'>>(
  pages: readonly P[],
): P | undefined {
  const kind = tabPageKind(pages);
  if (!kind) return undefined;
  for (let i = pages.length - 1; i >= 0; i--) if (pageKindOf(pages[i]!) === kind) return pages[i];
  return undefined;
}

/** A photo page's sheet on the canvas for a picture of `width` x `height` px: the picture's shape,
 *  its longer side at most PHOTO_SHEET_MAX canvas px (never scaled up), whole px, at least 1. */
export function photoSheetSides(width: number, height: number): PageSides {
  const scale = Math.min(1, PHOTO_SHEET_MAX / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** A new photo page (docs/specs/031-photo/photo-pages.md "Making a photo page"), its sheet the
 *  picture's shape. */
export function newPhotoPage(
  id: string,
  width = PHOTO_DEFAULT_WIDTH,
  height = PHOTO_DEFAULT_HEIGHT,
): Page {
  const fit = photoSheetSides(width, height);
  return {
    id,
    orientation: fit.width >= fit.height ? 'landscape' : 'portrait',
    size: 'photo',
    fit,
    kind: 'photo',
  };
}

/** A new wireframe page (docs/specs/007-editor/wireframe-pages.md "Choosing the device"): the
 *  device as it is held (upright, the iPhone Duo opened landscape), its frame Dark unless given, its system bars shown, on plain paper. */
export function newWireframePage(
  id: string,
  device: WireframeDeviceId = DEFAULT_WIREFRAME_DEVICE,
  frameLook?: WireframeFrameLook,
): Page {
  return {
    id,
    // A device held landscape by default (the iPhone Duo opened) starts turned.
    orientation: WIREFRAME_DEVICES[device].landscape ? 'landscape' : 'portrait',
    size: 'device',
    kind: 'wireframe',
    device,
    ...(frameLook && frameLook !== 'theme' ? { frameLook } : {}),
  };
}

/** A new logo page (docs/specs/007-editor/logo-pages.md "A logo page"): the 1024 artboard on
 *  plain paper. */
export function newLogoPage(id: string): Page {
  return { id, orientation: 'portrait', size: 'logo', kind: 'logo' };
}

/** Pages with the row anchor on the first page found carrying it, dropped from any other. Same
 *  array back when at most one carries it. */
function withOneRowAnchor(pages: Page[]): Page[] {
  if (pages.filter((p) => p.rowAt).length <= 1) return pages;
  const first = pages.findIndex((p) => p.rowAt);
  return pages.map((p, i) => {
    if (i === first || !p.rowAt) return p;
    const { rowAt: _drop, ...rest } = p;
    void _drop;
    return rest;
  });
}

/** The row anchor the pages carry: the first page's centre (the canvas origin when none does). */
export function pagesOf(tab: { pages?: unknown; pageOrientation?: unknown } | undefined): Page[] {
  const seen = new Set<string>();
  const stored = Array.isArray(tab?.pages)
    ? tab.pages.map(parsePage).filter((p): p is Page => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
    : [];
  if (stored.length > 0) return withOneRowAnchor(stored.slice(0, MAX_PAGES));
  const orientation = isPageOrientation(tab?.pageOrientation) ? tab.pageOrientation : 'portrait';
  return [{ id: FIRST_PAGE_ID, orientation }];
}

/** A page's width and height in canvas px: its size's sides, the long one upright in portrait.
 *  A square page is the same either way. */
export function pageLabel(
  page: Pick<Page, 'orientation' | 'size' | 'name' | 'kind' | 'device'>,
  index: number,
  count: number,
  // A photo page's picture size, which its label names in place of a paper size.
  photoSize?: { width: number; height: number },
): string {
  const parts: string[] = [];
  if (page.name) parts.push(page.name);
  else if (count > 1) parts.push(`Page ${index + 1}`);
  const sizeLabel =
    page.kind === 'photo' && photoSize
      ? `${photoSize.width} x ${photoSize.height}`
      : pageSizeLabel(page);
  parts.push(sizeLabel);
  const size = page.size ?? 'a4';
  // The sheet says which way it faces; the artboard is square.
  if (pageHasOrientation(page) && size === 'a4') {
    parts.push(page.orientation === 'portrait' ? 'Portrait' : 'Landscape');
  }
  // A turned device says so; upright is how a device is seen.
  if (size === 'device' && page.orientation === 'landscape' && pageHasOrientation(page))
    parts.push('Landscape');
  // The kind closes it, where it has one the size does not already name.
  const kind = pageKindOf(page);
  if (kind && !sizeLabel.toLowerCase().includes(PAGE_KIND_LABEL[kind].toLowerCase()))
    parts.push(PAGE_KIND_LABEL[kind]);
  return parts.join(' · ');
}

const PAGE_KIND_LABEL: Record<PageKind, string> = {
  logo: 'Logo',
  wireframe: 'Wireframe',
  photo: 'Photo',
};

/** The page's own margin, in canvas px: what layouts keep clear and snapping offers. */
export function nextPageId(pages: readonly Page[]): string {
  const taken = new Set(pages.map((p) => p.id));
  let id: string;
  do id = `page-${crypto.randomUUID().slice(0, 8)}`;
  while (taken.has(id));
  return id;
}

/** `next` carrying the row anchor `current` carries: handed to its first page when the page that
 *  carried it is gone, so the row stays where it is. Same array back when nothing is lost. */
function withRowAnchorKept(current: readonly Page[], next: readonly Page[]): readonly Page[] {
  const at = current.find((p) => p.rowAt)?.rowAt;
  if (!at || next.length === 0 || next.some((p) => p.rowAt)) return next;
  return [{ ...next[0]!, rowAt: at }, ...next.slice(1)];
}

/**
 * The tab with its pages replaced by `next`, every element moving with its page: an element whose
 * centre lies on a page that `next` keeps moves by however far that page moved (a page before it
 * turned, or was removed). Elements on a removed page, or on no page, stay where they are. One
 * tab edit, so one undo step. The legacy `pageOrientation` is dropped once pages are stored.
 */
export function withPages<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  nextPages: readonly Page[],
): T & { pages: Page[] } {
  const current = pagesOf(tab);
  const next = withRowAnchorKept(current, nextPages);
  const before = layOutPages(current);
  const after = new Map(layOutPages(next).map((p) => [p.id, p.rect]));
  // A page edit that moves no page (a name, a lock, a paint) moves no element: skip the walk.
  const still = before.every((p) => {
    const r = after.get(p.id);
    return (
      !r ||
      (r.x === p.rect.x &&
        r.y === p.rect.y &&
        r.width === p.rect.width &&
        r.height === p.rect.height)
    );
  });
  const shift = (point: { x: number; y: number }): { dx: number; dy: number } | null => {
    const page = rowPageAt(before, point);
    const moved = page && after.get(page.id);
    if (!page || !moved) return null;
    // A page's content is re-centred on the page's centre, so a page that turned keeps its content
    // about its middle.
    const dx = moved.x + moved.width / 2 - (page.rect.x + page.rect.width / 2);
    const dy = moved.y + moved.height / 2 - (page.rect.y + page.rect.height / 2);
    return dx === 0 && dy === 0 ? null : { dx, dy };
  };
  const elements = still
    ? tab.elements
    : tab.elements.map((el): Element => {
        if (isBoxed(el)) {
          const d = shift({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
          return d ? { ...el, x: el.x + d.dx, y: el.y + d.dy } : el;
        }
        // An arrow's free ends move with the page they sit on; pinned ends follow their element.
        const from = el.from.kind === 'free' ? shift(el.from) : null;
        const to = el.to.kind === 'free' ? shift(el.to) : null;
        if (!from && !to) return el;
        return {
          ...el,
          from:
            from && el.from.kind === 'free'
              ? { ...el.from, x: el.from.x + from.dx, y: el.from.y + from.dy }
              : el.from,
          to:
            to && el.to.kind === 'free'
              ? { ...el.to, x: el.to.x + to.dx, y: el.to.y + to.dy }
              : el.to,
        };
      });
  const { pageOrientation: _legacy, ...rest } = tab;
  void _legacy;
  return { ...withPhotosKept(rest as T, next), elements, pages: [...next] };
}

/** The tab without the photos of pages it no longer has (docs/specs/031-photo/photo-store.md "What
 *  is stored where"). Same tab back when every photo's page is still there. */
function withPhotosKept<T extends object>(tab: T, pages: readonly Page[]): T {
  const photos = (tab as { photos?: unknown }).photos;
  if (!photos || typeof photos !== 'object') return tab;
  const ids = new Set(pages.map((p) => p.id));
  const keys = Object.keys(photos);
  if (keys.every((k) => ids.has(k))) return tab;
  const kept = Object.fromEntries(
    Object.entries(photos as Record<string, unknown>).filter(([k]) => ids.has(k)),
  );
  const out = { ...tab } as T & { photos?: unknown };
  if (Object.keys(kept).length > 0) out.photos = kept;
  else delete out.photos;
  return out;
}
