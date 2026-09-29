// The import report: tallies per image element and the Import dialog's copy
// (docs/specs/020-import-export/import-image-pipeline.md "The report").

import { IMPORT_IMAGE_FAILURES, type ImportImageFailure, type ImportImageReport } from './types';

const FAILURE_SENTENCES: Record<ImportImageFailure, string> = {
  'missing-bytes': "The file didn't include the image data.",
  unsupported: "The image format couldn't be read.",
  'too-large': 'The image was too large to import.',
  'gallery-full': "Your image gallery is full. Free up space in the Explorer's Image Gallery.",
  'images-unavailable': "This server doesn't store images.",
  'offline-budget': 'This offline document reached its image limit for one import.',
  'upload-failed': "The upload didn't go through. Check your connection and try again.",
};

const PLACEHOLDER_HINT = 'Double-click a placeholder to add its image.';

export const emptyImportImageReport = (): ImportImageReport => ({
  imported: 0,
  deduped: 0,
  placeholders: {},
});

export const importImagePlaceholderCount = (report: ImportImageReport): number =>
  Object.values(report.placeholders).reduce((sum, n) => sum + (n ?? 0), 0);

export const importImageReportTotal = (report: ImportImageReport): number =>
  report.imported + report.deduped + importImagePlaceholderCount(report);

export type ImportImageReportCopy = {
  lines: string[];
  failures: { failure: ImportImageFailure; count: number; sentence: string }[];
  hint: string | null;
};

export function describeImportImageReport(report: ImportImageReport): ImportImageReportCopy {
  const placeholders = importImagePlaceholderCount(report);
  const lines: string[] = [];
  if (report.imported > 0) {
    lines.push(`${report.imported} ${report.imported === 1 ? 'image' : 'images'} imported`);
  }
  if (report.deduped > 0) lines.push(`${report.deduped} already in your gallery`);
  if (placeholders > 0) {
    lines.push(
      placeholders === 1 ? '1 left as a placeholder' : `${placeholders} left as placeholders`,
    );
  }
  const failures = IMPORT_IMAGE_FAILURES.flatMap((failure) => {
    const count = report.placeholders[failure] ?? 0;
    return count > 0 ? [{ failure, count, sentence: FAILURE_SENTENCES[failure] }] : [];
  });
  return { lines, failures, hint: placeholders > 0 ? PLACEHOLDER_HINT : null };
}
