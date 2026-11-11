// The page sizes and orientations Pages mode offers (docs/specs/007-editor/pages-mode.md "The pages"): A4, the
// logo, device and photo sizes, and a page's dimensions and size label from them. Re-exported from ./page.
import {
  DEFAULT_WIREFRAME_DEVICE,
  WIREFRAME_DEVICES,
  deviceGeometry,
  type WireframeDeviceId,
} from './wireframe-device';
import type { Page } from './page';

export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_ORIENTATIONS: readonly PageOrientation[] = ['portrait', 'landscape'];

// A4 is 210 x 297 mm; at the CSS 96 px per inch that is 793.7 x 1122.5, rounded to whole pixels.
export const A4_SHORT_SIDE = 794;
export const A4_LONG_SIDE = 1123;

// The space between two pages in the row, in canvas px.
export const PAGE_GAP = 96;

// The most pages a tab holds (docs/specs/007-editor/pages-mode.md "Page actions"): room for a
// wireframe flow's every screen beside its logo options.
export const MAX_PAGES = 100;

// A page's format (docs/specs/007-editor/pages-mode.md "Sizes"): its short and long side.
// A4 is the sheet of a page whose kind is not chosen yet; a logo page is the artboard, a wireframe
// page its device, a photo page its picture's size.
export type PageSizeId = 'a4' | 'logo' | 'device' | 'photo' | 'fit';

// A logo page's artboard (docs/specs/007-editor/logo-pages.md "A logo page"): the common
// app-icon master, square.
export const LOGO_SIDE = 1024;

// A logo page's margin, its safe area, as a share of its side (docs/specs/007-editor/logo-pages.md).
export const LOGO_SAFE_FRACTION = 0.1;

export const PAGE_SIZES: Readonly<
  Record<
    PageSizeId,
    {
      short: number;
      long: number;
      portrait: string;
      landscape: string;
      // The logo artboard: offered by logo pages alone.
      logoOnly?: true;
      // A wireframe page's device: its sides are the device's frame (`Page.device`); short and long
      // here are only what a page in it without one is read as (the iPhone).
      deviceOnly?: true;
      // A photo page's own size: its sides are the page's (`Page.fit`), its picture's shape.
      photoOnly?: true;
      // Fit to Content: its sides are the page's own (`Page.fit`); short and long here
      // are only what a page in it without them is read as (A4).
      fitOnly?: true;
    }
  >
> = {
  a4: { short: A4_SHORT_SIDE, long: A4_LONG_SIDE, portrait: 'A4', landscape: 'A4' },
  logo: {
    short: LOGO_SIDE,
    long: LOGO_SIDE,
    portrait: '1024 x 1024',
    landscape: '1024 x 1024',
    logoOnly: true,
  },
  device: {
    short: 423,
    long: 876,
    portrait: 'Device',
    landscape: 'Device',
    deviceOnly: true,
  },
  photo: {
    short: 1080,
    long: 1920,
    portrait: 'Photo',
    landscape: 'Photo',
    photoOnly: true,
  },
  fit: {
    short: A4_SHORT_SIDE,
    long: A4_LONG_SIDE,
    portrait: 'Fit to Content',
    landscape: 'Fit to Content',
    fitOnly: true,
  },
};

export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES) as PageSizeId[];

// The one size a logo page takes (docs/specs/007-editor/logo-pages.md "A logo page").
export const LOGO_PAGE_SIZE_IDS: readonly PageSizeId[] = ['logo'];
// A wireframe page's one size is its device (docs/specs/007-editor/wireframe-pages.md).
export const WIREFRAME_PAGE_SIZE_IDS: readonly PageSizeId[] = ['device'];
// A photo page is its picture's size (docs/specs/031-photo/photo-pages.md "A photo page").
export const PHOTO_PAGE_SIZE_IDS: readonly PageSizeId[] = ['photo'];
// A page not chosen yet is a plain sheet until it is.
export const UNCHOSEN_PAGE_SIZE_IDS: readonly PageSizeId[] = ['a4'];

/** The sizes a page of this kind offers in its panel: a logo page only the artboard, a wireframe
 *  page its device, a photo page its picture's size, a page not chosen yet its sheet. */
export function isPageSizeId(v: unknown): v is PageSizeId {
  return typeof v === 'string' && v in PAGE_SIZES;
}

// What a page is painted with (docs/specs/007-editor/pages-mode.md "Backgrounds"): a fill
// (absent is the paper: a colour, a gradient or a picture, "Image backgrounds") and a pattern over it. The colours,
// patterns and motions live in @liveworkspace/page-background, which a form's cover shares; re-exported here.
export function pageDimensions(
  page: Pick<Page, 'orientation' | 'size' | 'fit'> & { device?: WireframeDeviceId },
): {
  width: number;
  height: number;
} {
  if ((page.size === 'fit' || page.size === 'photo') && page.fit)
    return { width: page.fit.width, height: page.fit.height };
  if (page.size === 'device') {
    const g = deviceGeometry(
      page.device ?? DEFAULT_WIREFRAME_DEVICE,
      page.orientation === 'landscape',
    );
    return { width: g.width, height: g.height };
  }
  const { short, long } = PAGE_SIZES[page.size ?? 'a4'];
  return page.orientation === 'portrait'
    ? { width: short, height: long }
    : { width: long, height: short };
}

/** Whether a page has an orientation to choose (a logo's square artboard has none, nor Fit to
 *  Content nor a photo page, whose picture sets its shape; a wireframe page while its device
 *  turns). */
export function pageHasOrientation(
  page: Pick<Page, 'size'> & { device?: WireframeDeviceId },
): boolean {
  if (page.size === 'device')
    return WIREFRAME_DEVICES[page.device ?? DEFAULT_WIREFRAME_DEVICE].turns;
  const { short, long, fitOnly, photoOnly } = PAGE_SIZES[page.size ?? 'a4'];
  return short !== long && !fitOnly && !photoOnly;
}

/** The size's name as this page shows it ("A4", "1024 x 1024", a wireframe page's "iPhone"). */
export function pageSizeLabel(
  page: Pick<Page, 'orientation' | 'size'> & { device?: WireframeDeviceId },
): string {
  if (page.size === 'device')
    return WIREFRAME_DEVICES[page.device ?? DEFAULT_WIREFRAME_DEVICE].label;
  return PAGE_SIZES[page.size ?? 'a4'][page.orientation];
}

/** The label above a page: its name, or "Page n" once there are several, then its size, where it
 *  has one its orientation, and its kind where it has one the size does not name ("Page 2 · A4 ·
 *  Landscape", "Badge · 1024 x 1024 · Logo"). */
