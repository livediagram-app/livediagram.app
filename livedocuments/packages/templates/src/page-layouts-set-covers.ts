// More Covers layouts (docs/specs/007-editor/pages-mode.md "Layouts"), category 'covers':
// pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the page's
// content box so each fits every size and orientation, in the tab's theme. The builders live in
// page-layouts-set-covers-docs.ts (document fronts) and page-layouts-set-covers-print.ts (print
// fronts), on the parts in page-layouts-set-covers-parts.ts.
import type { PageLayout } from './page-layouts';
import {
  buildCaseStudyCover,
  buildContents,
  buildProposalCover,
  buildReportCover,
} from './page-layouts-set-covers-docs';
import {
  buildBookCover,
  buildCertificate,
  buildMagazineCover,
  buildNewsletterFront,
} from './page-layouts-set-covers-print';

export type CoversSetLayoutId =
  | 'report-cover'
  | 'magazine-cover'
  | 'book-cover'
  | 'proposal-cover'
  | 'case-study-cover'
  | 'newsletter-front'
  | 'contents'
  | 'certificate';

export const COVERS_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'report-cover',
    category: 'covers',
    label: 'Report Cover',
    description: 'A huge year, the report title, a picture and three headline figures',
    build: buildReportCover,
  },
  {
    id: 'magazine-cover',
    category: 'covers',
    label: 'Magazine Cover',
    description: 'A masthead, an issue strip, cover lines beside a picture and the cover story',
    build: buildMagazineCover,
  },
  {
    id: 'book-cover',
    category: 'covers',
    label: 'Book Cover',
    description: 'A framed jacket: author, title, ornament, round artwork, a blurb and the press',
    build: buildBookCover,
  },
  {
    id: 'proposal-cover',
    category: 'covers',
    label: 'Proposal Cover',
    description: 'A logo, the proposal title and who it is for, by whom, when and its reference',
    build: buildProposalCover,
  },
  {
    id: 'case-study-cover',
    category: 'covers',
    label: 'Case Study',
    description: 'An outcome headline, a picture, a client quote and three results',
    build: buildCaseStudyCover,
  },
  {
    id: 'newsletter-front',
    category: 'covers',
    label: 'Newsletter',
    description: 'A masthead and dateline, the lead story with its picture and In this issue',
    build: buildNewsletterFront,
  },
  {
    id: 'contents',
    category: 'covers',
    label: 'Contents',
    description: 'Six numbered chapters, a note and a page number each',
    build: buildContents,
  },
  {
    id: 'certificate',
    category: 'covers',
    label: 'Certificate',
    description: 'A framed award: who it is for, why, two signature lines and a seal',
    build: buildCertificate,
  },
];
