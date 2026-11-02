// The PowerPoint and Word panel's words (docs/specs/020-import-export/office-export.md "Where it is offered" and "The
// panel"): which card a tab offers, what its file holds and what stays editable. Pure, so the dialog's chunk carries
// it without the writers.

import {
  pageSlideIdFor,
  slideHasNotes,
  tabPageKind,
  type Deck,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';

export type OfficeFormat = 'pptx' | 'docx';

/** The page's slide in the deck: its own page slide, else any slide showing that page. */
export function slideOfPage(deck: Deck | undefined, tabId: string, pageId: string) {
  const own = pageSlideIdFor(tabId, pageId);
  return (
    deck?.slides.find((s) => s.id === own) ??
    deck?.slides.find((s) => s.tabId === tabId && s.pageId === pageId)
  );
}

/** The office format a Pages tab offers: PowerPoint for a deck, Word for an article, neither otherwise. */
export function officeFormatFor(pages: readonly LaidOutPage[] | undefined): OfficeFormat | null {
  if (!pages || pages.length === 0) return null;
  const kind = tabPageKind(pages);
  return kind === 'slide' ? 'pptx' : kind === 'article' ? 'docx' : null;
}

export const OFFICE_CARDS: Readonly<Record<OfficeFormat, { title: string; description: string }>> =
  {
    pptx: {
      title: 'PowerPoint',
      description:
        'Every page as an editable slide, with its notes. Opens in Keynote and Google Slides too.',
    },
    docx: {
      title: 'Word',
      description:
        'The article as an editable document, its headings as Word styles. Opens in Google Docs.',
    },
  };

export const OFFICE_SUBTITLE: Readonly<Record<OfficeFormat, string>> = {
  pptx: 'Download the tab as a PowerPoint deck.',
  docx: 'Download the article as a Word document.',
};

export const OFFICE_EDITABLE: Readonly<Record<OfficeFormat, readonly string[]>> = {
  pptx: [
    'Text boxes keep their font, size, colour and alignment',
    'Rectangles, circles and other basic shapes stay shapes',
    'Charts, icons, pictures and arrows come as pictures',
  ],
  docx: [
    'Headings, quotes and code as Word styles',
    'Bulleted, numbered and to-do lists',
    'Links, bold, italic and the rest of the text formatting',
    'Pictures, charts and drawings as images',
  ],
};

/** What the file holds, one line. */
export function officeSummary(
  format: OfficeFormat,
  tab: Pick<Tab, 'id'>,
  pages: readonly LaidOutPage[],
  deck: Deck | undefined,
): string {
  const n = pages.length;
  if (format === 'docx')
    return n === 1
      ? "The article's writing, its pictures and drawings as images."
      : `The article's ${n} pages of writing, its pictures and drawings as images.`;
  if (n === 1) return '1 slide.';
  const noted = pages.filter((p) => {
    const slide = slideOfPage(deck, tab.id, p.id);
    return slide ? slideHasNotes(slide) : false;
  }).length;
  return noted > 0
    ? `${n} slides, one a page, with the speaker notes of ${noted}.`
    : `${n} slides, one a page.`;
}
