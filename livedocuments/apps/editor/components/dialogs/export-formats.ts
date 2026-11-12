// The Export dialog's formats (ExportTabDialog): the keys, the cards in display order, the text formats'
// panels, and Pages mode's own formats and copy. The labels their telemetry reports stay with the dialog's track
// calls (ExportTabDialog), where the telemetry dashboard's emitter scan reads them.
import { type Tab, tabToJsonText, tabToMarkdownText } from '@livedocuments/document';
import { OFFICE_CARDS, type OfficeFormat } from '@/lib/office-export/summary';

// The formats Pages mode exports to (docs/specs/007-editor/pages-mode.md "Export"):
// its pages, and the tab itself as JSON. Diagram-tool formats are not offered.
// Print sits after PDF on every kind (docs/specs/020-import-export/print.md "Where it is offered").
export const PAGES_FORMATS: readonly Format[] = [
  'pdf',
  'print',
  'png',
  'svg',
  'gif',
  'pptx',
  'docx',
  'file',
];
// The page formats' card copy in Pages mode, which speaks of pages rather than the tab.
export const PAGES_CARD_COPY: Partial<Record<Format, string>> = {
  pdf: 'Every page in one PDF, or a single page, ready to print or share.',
  png: 'A high-resolution image of a page, or a .zip with one per page.',
  svg: 'A scalable vector image of a page, or a .zip with one per page.',
};

// The format keys ('file' is the livedocuments .json).
export type Format = 'markdown' | 'pdf' | 'print' | 'png' | 'svg' | 'gif' | OfficeFormat | 'file';

// The two text formats each open a view/edit/copy panel; the three image
// formats each open an options-and-download panel (docs/specs/010-palette/style-presets.md / 73).
export type TextFormat = 'file' | 'markdown';
export type ImageFormat = 'png' | 'svg' | 'pdf';
export const isTextFormat = (f: Format): f is TextFormat => f === 'file' || f === 'markdown';
export const isOfficeFormat = (f: Format | null): f is OfficeFormat => f === 'pptx' || f === 'docx';

// Grid card copy, in display order: text formats first, then image formats.
export const CARDS: { kind: Format; title: string; description: string }[] = [
  {
    kind: 'file',
    title: 'JSON',
    description: 'A livedocuments file. Copy it or save a .json to import back with full fidelity.',
  },
  {
    kind: 'markdown',
    title: 'Markdown',
    description: "A text outline of this tab's elements and connections. Copy it or save a .md.",
  },
  {
    kind: 'png',
    title: 'PNG',
    description: 'A high-resolution image of this tab, for slides or screenshots.',
  },
  {
    kind: 'svg',
    title: 'SVG',
    description: 'A scalable vector image, crisp at any size and editable in design tools.',
  },
  {
    kind: 'pdf',
    title: 'PDF',
    description: 'A single-page PDF of this tab, ready to print or share.',
  },
  {
    // Pages only (docs/specs/020-import-export/print.md "Where it is offered").
    kind: 'print',
    title: 'Print',
    description:
      'Send the current page or the whole document to your printer, each page its own sheet.',
  },
  {
    // Pages mode only (docs/specs/020-import-export/animated-gif-export.md "Where it is offered").
    kind: 'gif',
    title: 'GIF',
    description: 'An animated image of the pages, moving as they move on the canvas.',
  },
  // A slide tab's or an article tab's only (docs/specs/020-import-export/office-export.md "Where it is offered").
  { kind: 'pptx', ...OFFICE_CARDS.pptx },
  { kind: 'docx', ...OFFICE_CARDS.docx },
];

// Per-text-format panel config: the blurb, the download button label + file
// extension + mime, and how to serialise the tab to the editable text.
export const TEXT_PANELS: Record<
  TextFormat,
  {
    blurb: string;
    downloadLabel: string;
    ext: string;
    mime: string;
    getText: (tab: Tab) => string;
  }
> = {
  file: {
    blurb:
      "This tab as a livedocuments JSON export. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .json',
    ext: 'livedocuments-tab.json',
    mime: 'application/json',
    getText: (tab) => tabToJsonText(tab),
  },
  markdown: {
    blurb:
      "This tab as a Markdown outline. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .md',
    ext: 'md',
    mime: 'text/markdown',
    getText: (tab) => tabToMarkdownText(tab),
  },
};
