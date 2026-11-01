// What an import left out, as the Import dialog's report lines (docs/specs/020-import-export/office-import.md "The
// report"): one line per kind of thing, with its count, then one per reason pictures could not be stored.

import {
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_TABLE_COLS,
  MAX_ARTICLE_TABLE_ROWS,
} from '@livedocuments/document';
import type { ImportImageFailure } from '../import-images';
import type { FileImportFormat } from './errors';
import { OFFICE_MAX_IMAGES, OFFICE_MAX_SLIDE_ITEMS } from './limits';
import type { PictureOutcome } from './store-images';
import { SKIP_KINDS, type SkipKind, type SkipTally } from './tally';

export type ReportLine = { title: string; message: string };

const n = (v: number) => v.toLocaleString('en-GB');
const plural = (count: number, one: string, many: string) =>
  `${n(count)} ${count === 1 ? one : many}`;
const was = (count: number) => (count === 1 ? 'was' : 'were');

function skipLine(kind: SkipKind, count: number, format: FileImportFormat): ReportLine {
  switch (kind) {
    case 'tables':
      return format === 'word'
        ? {
            title: 'Tables',
            message: `${plural(count, 'table was', 'tables were')} cut to fit: a table holds at most ${n(MAX_ARTICLE_TABLE_ROWS)} rows and ${MAX_ARTICLE_TABLE_COLS} columns.`,
          }
        : { title: 'Tables', message: `${plural(count, 'table was', 'tables were')} left out.` };
    case 'footnotes':
      return {
        title: 'Footnotes',
        message: `${plural(count, 'footnote', 'footnotes')} ${was(count)} left out.`,
      };
    case 'comments':
      return {
        title: 'Comments',
        message: `${plural(count, 'comment', 'comments')} ${was(count)} left out.`,
      };
    case 'headersFooters':
      return { title: 'Headers and footers', message: 'The headers and footers were left out.' };
    case 'textBoxes':
      return {
        title: 'Text boxes',
        message: `${plural(count, 'text box or shape', 'text boxes and shapes')} ${was(count)} left out.`,
      };
    case 'charts':
      return {
        title: 'Charts',
        message: `${plural(count, 'chart', 'charts')} ${was(count)} left out.`,
      };
    case 'diagrams':
      return {
        title: 'Diagrams',
        message: `${plural(count, 'diagram (SmartArt)', 'diagrams (SmartArt)')} ${was(count)} left out.`,
      };
    case 'equations':
      return {
        title: 'Equations',
        message: `${plural(count, 'equation', 'equations')} ${was(count)} left out.`,
      };
    case 'media':
      return {
        title: 'Video and audio',
        message: `${plural(count, 'video or audio clip', 'videos and audio clips')} ${was(count)} left out.`,
      };
    case 'embedded':
      return {
        title: 'Embedded objects',
        message: `${plural(count, 'embedded object', 'embedded objects')} ${was(count)} left out.`,
      };
    case 'linkedImages':
      return {
        title: 'Linked pictures',
        message: `${plural(count, 'linked picture was', 'linked pictures were')} left out: only pictures inside the file come in.`,
      };
    case 'shapes':
      return {
        title: 'Shapes',
        message: `${plural(count, 'shape or line', 'shapes and lines')} without text ${was(count)} left out.`,
      };
    case 'crowded':
      return {
        title: 'Crowded slides',
        message: `${plural(count, 'item', 'items')} past ${n(OFFICE_MAX_SLIDE_ITEMS)} on a slide ${was(count)} left out.`,
      };
    case 'longText':
      return {
        title: 'Long paragraphs',
        message: `${plural(count, 'paragraph was', 'paragraphs were')} cut to ${n(MAX_ARTICLE_BLOCK_TEXT)} characters.`,
      };
  }
}

type ImageReason = ImportImageFailure | 'over-cap';

const IMAGE_REASONS: readonly ImageReason[] = [
  'unsupported',
  'missing-bytes',
  'too-large',
  'gallery-full',
  'images-unavailable',
  'offline-budget',
  'upload-failed',
  'over-cap',
];

function imageWhy(reason: ImageReason): string {
  switch (reason) {
    case 'unsupported':
      return "their format can't be shown in a browser (EMF, WMF or TIFF)";
    case 'missing-bytes':
      return "they aren't in the file";
    case 'too-large':
      return 'they are too large';
    case 'gallery-full':
      return 'your image gallery is full';
    case 'images-unavailable':
      return "image uploads aren't available on this server";
    case 'offline-budget':
      return 'an offline document takes at most 8 MB of images an import';
    case 'upload-failed':
      return 'the upload failed';
    case 'over-cap':
      return `an import saves at most ${n(OFFICE_MAX_IMAGES)} images`;
  }
}

export function officeImportReport(
  tally: SkipTally,
  outcomes: ReadonlyMap<string, PictureOutcome>,
  format: FileImportFormat,
): ReportLine[] {
  const lines: ReportLine[] = [];
  const failed = new Map<ImageReason, number>();
  for (const o of outcomes.values()) {
    const reason = o === 'over-cap' ? 'over-cap' : o.ok ? null : o.failure;
    if (reason) failed.set(reason, (failed.get(reason) ?? 0) + 1);
  }
  for (const reason of IMAGE_REASONS) {
    const count = failed.get(reason);
    if (!count) continue;
    lines.push({
      title: 'Images',
      message: `${count === 1 ? "1 image couldn't be saved" : `${n(count)} images couldn't be saved`}: ${imageWhy(reason)}. ${count === 1 ? "It's an empty placeholder" : "They're empty placeholders"} you can fill.`,
    });
  }
  for (const kind of SKIP_KINDS) {
    const count = tally[kind];
    if (count) lines.push(skipLine(kind, count, format));
  }
  return lines;
}
