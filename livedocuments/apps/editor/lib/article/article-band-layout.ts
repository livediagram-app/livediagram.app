// Where an article page's header and footer go (docs/specs/007-editor/article-pages.md "Headers and
// footers"): the parts each line shows (articleBandsFor) and their places on the page, in page px from
// its top-left corner. Read by the page on the canvas (PageBands) and by an export (pageWriting), so both
// draw them alike. And the document's name, for a `{name}` field: set by the editor's host as the
// document is named, read as a page draws.
import { useSyncExternalStore } from 'react';
import {
  articleBandsFor,
  articleMarginPx,
  articleTopMarginPx,
  bandDate,
  resolveArticleStyle,
  resolveFontStack,
  type ArticleFlow,
  type LaidOutPage,
  type PageBand,
} from '@livedocuments/document';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** A header's or footer's line: the middle of its 12 px type, and its parts. */
export type BandLine = { y: number; parts: PageBand };

/** A page's header and footer as drawn: the margins the left and right parts align to, the type. */
export type PageBandLayout = {
  left: number;
  right: number;
  font: string;
  header?: BandLine;
  footer?: BandLine;
};

// The header's line: centred in the band just above the text.
const HEADER_FROM_TEXT = 16;

/**
 * A page's header and footer, or null when it shows none: a flashcard, a page with no article, the first
 * page with Different First Page on, or no header, footer or page number at all. `own` is the article's
 * pages in order.
 */
export function pageBandLayout(
  style: ArticleFlow['style'] | undefined,
  own: readonly Pick<LaidOutPage, 'id'>[],
  page: Pick<LaidOutPage, 'id' | 'kind' | 'rect'>,
  name: string,
  date?: string,
): PageBandLayout | null {
  if (page.kind === 'flashcard') return null;
  // Most articles have neither: nothing to work out (this runs for every page on every render).
  if (!style?.header && !style?.footer && !style?.pageNumbers) return null;
  const index = own.findIndex((p) => p.id === page.id);
  if (index < 0) return null;
  const resolved = resolveArticleStyle(style);
  const bands = articleBandsFor(
    style,
    resolved.pageNumbers,
    index,
    own.length,
    name,
    date ?? todayForBands(),
  );
  if (!bands) return null;
  const margin = articleMarginPx(style);
  return {
    left: margin,
    right: page.rect.width - margin,
    font: resolveFontStack(resolved.bodyFont) ?? 'system-ui, sans-serif',
    ...(bands.header
      ? { header: { y: articleTopMarginPx(style) - HEADER_FROM_TEXT, parts: bands.header } }
      : {}),
    ...(bands.footer ? { footer: { y: page.rect.height - margin / 2, parts: bands.footer } } : {}),
  };
}

// Today as a {date} field shows it, worked out once a day: toLocaleDateString costs about 1 ms a call,
// and every page asks on every render.
let today: { day: string; text: string } | null = null;
function todayForBands(): string {
  const now = new Date();
  const day = now.toDateString();
  if (today?.day !== day) today = { day, text: bandDate(now) };
  return today.text;
}

let documentName = '';
const nameListeners = createListeners();

/** The document's name as a `{name}` field shows it. */
export function setBandDocumentName(name: string): void {
  if (name === documentName) return;
  documentName = name;
  nameListeners.notify();
}

export const bandDocumentName = (): string => documentName;

/** The document's name, followed as it changes. */
export function useBandDocumentName(): string {
  return useSyncExternalStore(nameListeners.subscribe, bandDocumentName, () => '');
}
