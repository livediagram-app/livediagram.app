// What a Word export writes (docs/specs/020-import-export/blueprints/office-export.md "Domain and naming"): the
// article's blocks in order, its zones already drawn as images, the look its styles carry and the paper.

import type {
  ArticleBand,
  ArticleBlock,
  ArticleTocEntry,
  ArticleParagraphStyle,
  ArticleRules,
  ArticleZoneAlign,
  ArticleZoneWrap,
} from '@livedocuments/document';

/** A zone drawn: its PNG at twice its size, its size in page px, and how it sits in the writing. */
export type DocxImage = {
  type: 'image';
  png: Uint8Array;
  widthPx: number;
  heightPx: number;
  wrap: ArticleZoneWrap;
  align: ArticleZoneAlign;
};

/** A contents block resolved: the headings of its article it lists, each with the page the editor laid it on (absent
 *  when no editor has laid the article out; Word fills them on Update Field). */
export type DocxToc = {
  type: 'docxToc';
  id: string;
  depth: 1 | 2 | 3;
  entries: (ArticleTocEntry & { page?: number })[];
};

export type DocxBlock =
  Exclude<ArticleBlock, { type: 'zone' } | { type: 'toc' }> | DocxImage | DocxToc;

/** The header and footer (docs/specs/007-editor/article-pages.md "Headers and footers"), with the values their
 *  name and date fields take as of the export; page numbers are the look's. */
export type DocxBands = {
  header?: ArticleBand;
  footer?: ArticleBand;
  differentFirstPage: boolean;
  name: string;
  date: string;
};

/** The article's style resolved to what Word's styles say: faces, sizes in px, colours as six hex digits. */
export type DocxLook = {
  headingFont: string;
  bodyFont: string;
  codeFont: string;
  /** The body text's size, px (Small 14, Normal 16, Large 18). */
  bodyPx: number;
  /** Line height, a multiple of the size. */
  lineHeight: number;
  /** Space after a body paragraph, in lines. */
  paragraphSpace: number;
  accent: string;
  accentHeadings: boolean;
  ink: string;
  muted: string;
  rules: ArticleRules;
  pageNumbers: boolean;
};

/** The paper, in page px: its sides, its margins, and whether it lies landscape. */
export type DocxPage = {
  widthPx: number;
  heightPx: number;
  landscape: boolean;
  marginPx: number;
  topMarginPx: number;
};

export type DocxDocument = {
  title: string;
  look: DocxLook;
  page: DocxPage;
  blocks: DocxBlock[];
  bands?: DocxBands;
};

export type { ArticleParagraphStyle };
