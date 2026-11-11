// The page sizes and orientations Pages mode offers (docs/specs/007-editor/pages-mode.md "The pages"): A4 and the
// other paper and screen sizes, the slide and flashcard sizes, and a page's dimensions and size label from them.
// Re-exported from ./page.
import type { Page } from './page';

export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_ORIENTATIONS: readonly PageOrientation[] = ['portrait', 'landscape'];

// A4 is 210 x 297 mm; at the CSS 96 px per inch that is 793.7 x 1122.5, rounded to whole pixels.
export const A4_SHORT_SIDE = 794;
export const A4_LONG_SIDE = 1123;

// The space between two pages in the row, in canvas px.
export const PAGE_GAP = 96;

// The most pages a tab holds (docs/specs/007-editor/pages-mode.md "Page actions"): room
// for a long document's pages beside a set of infographic ones.
export const MAX_PAGES = 100;

// A page's format (docs/specs/007-editor/pages-mode.md "Sizes"): its short and long side.
export type PageSizeId =
  | 'a4'
  | 'letter'
  | 'a3'
  | 'square'
  | 'social'
  | 'wide'
  | 'slide'
  | 'slide-classic'
  | 'fit'
  | 'card';

export const PAGE_SIZES: Readonly<
  Record<
    PageSizeId,
    {
      short: number;
      long: number;
      portrait: string;
      landscape: string;
      // A slide size is landscape whatever the page's stored orientation, and offers no turn.
      landscapeOnly?: true;
      // Fit to Content: its sides are the page's own (`Page.fit`); short and long here
      // are only what a page in it without them is read as (A4).
      fitOnly?: true;
    }
  >
> = {
  a4: { short: A4_SHORT_SIDE, long: A4_LONG_SIDE, portrait: 'A4', landscape: 'A4' },
  letter: { short: 816, long: 1056, portrait: 'US Letter', landscape: 'US Letter' },
  a3: { short: 1123, long: 1587, portrait: 'A3', landscape: 'A3' },
  square: { short: 1080, long: 1080, portrait: 'Square', landscape: 'Square' },
  social: {
    short: 1080,
    long: 1350,
    portrait: 'Portrait post (4:5)',
    landscape: 'Landscape post (5:4)',
  },
  wide: { short: 1080, long: 1920, portrait: 'Story (9:16)', landscape: 'Widescreen (16:9)' },
  slide: {
    short: 1080,
    long: 1920,
    portrait: 'Slide (16:9)',
    landscape: 'Slide (16:9)',
    landscapeOnly: true,
  },
  'slide-classic': {
    short: 1080,
    long: 1440,
    portrait: 'Classic slide (4:3)',
    landscape: 'Classic slide (4:3)',
    landscapeOnly: true,
  },
  fit: {
    short: A4_SHORT_SIDE,
    long: A4_LONG_SIDE,
    portrait: 'Fit to Content',
    landscape: 'Fit to Content',
    fitOnly: true,
  },
  // A flashcard (docs/specs/007-editor/flashcards.md "A card"): a 5:3 index card at screen size,
  // room for a title and a couple of paragraphs.
  card: {
    short: 540,
    long: 900,
    portrait: 'Flashcard (5:3)',
    landscape: 'Flashcard (5:3)',
    landscapeOnly: true,
  },
};

export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES) as PageSizeId[];

// The sizes a slide page may take (docs/specs/007-editor/pages-mode.md "Sizes"), the first
// its default.
export const SLIDE_PAGE_SIZE_IDS: readonly PageSizeId[] = ['slide', 'slide-classic'];
// The one size a flashcard takes (docs/specs/007-editor/flashcards.md "A card").
export const FLASHCARD_PAGE_SIZE_IDS: readonly PageSizeId[] = ['card'];
export const PAPER_AND_SCREEN_SIZE_IDS: readonly PageSizeId[] = [
  'a4',
  'letter',
  'a3',
  'square',
  'social',
  'wide',
];

/** The sizes a page of this kind offers in its panel: a slide page only the slide sizes, a
 *  flashcard only the card, an infographic or article page the paper and screen ones (a slide size
 *  is a slide page's alone: a deck is made of slide pages). */
export function isPageSizeId(v: unknown): v is PageSizeId {
  return typeof v === 'string' && v in PAGE_SIZES;
}

// What a page is painted with (docs/specs/007-editor/pages-mode.md "Backgrounds"): a fill
// (absent is the paper: a colour, a gradient or a picture, "Image backgrounds") and a pattern over it. The colours,
// patterns and motions live in @liveworkspace/page-background, which a form's cover shares; re-exported here.
export function pageDimensions(page: Pick<Page, 'orientation' | 'size' | 'fit'>): {
  width: number;
  height: number;
} {
  if (page.size === 'fit' && page.fit) return { width: page.fit.width, height: page.fit.height };
  const { short, long, landscapeOnly } = PAGE_SIZES[page.size ?? 'a4'];
  return page.orientation === 'portrait' && !landscapeOnly
    ? { width: short, height: long }
    : { width: long, height: short };
}

/** Whether a page has an orientation to choose (a square page has none, nor a slide size). */
export function pageHasOrientation(page: Pick<Page, 'size'>): boolean {
  const { short, long, landscapeOnly, fitOnly } = PAGE_SIZES[page.size ?? 'a4'];
  return short !== long && !landscapeOnly && !fitOnly;
}

/** The size's name as this page shows it ("A4", "Slide (16:9)"). */
export function pageSizeLabel(page: Pick<Page, 'orientation' | 'size'>): string {
  const size = PAGE_SIZES[page.size ?? 'a4'];
  return size[size.landscapeOnly ? 'landscape' : page.orientation];
}

/** The label above a page: its name, or "Page n" once there are several, then its size, where it
 *  has one its orientation, and its kind but for an infographic page or where the size names it
 *  ("Page 2 · A4 · Landscape", "Launch · Square · Article", "Intro · Slide (16:9)"). */
