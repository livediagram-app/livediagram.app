// An article's header and footer (docs/specs/007-editor/article-pages.md "Headers and footers"): a
// line at the top and the bottom of every page, a left, a centre and a right part, with fields for the
// page number, the page count, the document's name and the date. Part of the article's style; what
// each page shows is worked out here, never stored. Pure.

// The longest a part of a header or footer may be.
export const ARTICLE_BAND_MAX = 200;

/** A header or a footer: its left, centre and right parts, plain text with fields. */
export type ArticleBand = { left?: string; center?: string; right?: string };

const PARTS = ['left', 'center', 'right'] as const;
type BandPart = (typeof PARTS)[number];

/** The fields a part may hold, as typed, in the order the Style popover offers them. */
export const ARTICLE_BAND_FIELDS = [
  { token: '{page}', label: 'Page Number' },
  { token: '{pages}', label: 'Page Count' },
  { token: '{name}', label: 'Document Name' },
  { token: '{date}', label: 'Date' },
] as const;

// Control characters (a pasted tab or newline) read as a space: a part is one line.
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]+/g;

/** A stored header or footer read defensively: each part a string, one line, at most ARTICLE_BAND_MAX
 *  characters; empty parts dropped; undefined when none is left. */
export function parseArticleBand(v: unknown): ArticleBand | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return undefined;
  const out: ArticleBand = {};
  for (const part of PARTS) {
    const raw = b[part];
    if (typeof raw !== 'string') continue;
    const text = raw.replace(CONTROL, ' ').slice(0, ARTICLE_BAND_MAX);
    if (text.trim()) out[part] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The values a page's fields take. */
export type BandValues = { page: number; pages: number; name: string; date: string };

/** A part's text with its fields filled in. */
export function fillBand(text: string, v: BandValues): string {
  return text.replace(/\{(page|pages|name|date)\}/g, (_, field: keyof BandValues) =>
    String(v[field]),
  );
}

/** What one page shows: its header's and footer's parts, filled; a part absent when empty. */
export type PageBand = Partial<Record<BandPart, string>>;
export type PageBands = { header?: PageBand; footer?: PageBand };

/** Today's date as a header or footer writes it: the reader's own long form ("1 November 2026"). */
export function bandDate(at: Date = new Date()): string {
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The header and footer a page of an article shows: `index` its place in the article (0 first),
 * `count` the article's pages. Null when it shows none (Different First Page on its first page, or no
 * header, footer or page number at all). With page numbers on, the number fills the footer's centre
 * while the footer has no centre of its own.
 */
export function articleBandsFor(
  style: { header?: ArticleBand; footer?: ArticleBand; differentFirstPage?: boolean } | undefined,
  pageNumbers: boolean,
  index: number,
  count: number,
  name: string,
  date: string,
): PageBands | null {
  if (index === 0 && style?.differentFirstPage === true) return null;
  const values: BandValues = { page: index + 1, pages: count, name, date };
  const fill = (band: ArticleBand | undefined): PageBand | undefined => {
    if (!band) return undefined;
    const out: PageBand = {};
    for (const part of PARTS) {
      const text = band[part] ? fillBand(band[part], values).trim() : '';
      if (text) out[part] = text;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };
  const header = fill(style?.header);
  let footer = fill(style?.footer);
  if (pageNumbers && !style?.footer?.center) footer = { ...footer, center: String(index + 1) };
  if (!header && !footer) return null;
  return { ...(header ? { header } : {}), ...(footer ? { footer } : {}) };
}
