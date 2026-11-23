// The copy of a Word or PowerPoint import's named failures (@liveworkspace/office-files/errors)
// (docs/specs/020-import-export/office-import.md "Errors").

import { MAX_ARTICLE_BLOCKS, MAX_PAGES } from '@liveknowledge/document';

import type { FileImportFormat, OfficeImportFailure } from '@liveworkspace/office-files/errors';

const n = (v: number) => v.toLocaleString('en-GB');

/** The message the file panel shows for a failure. */
export function officeErrorMessage(
  failure: OfficeImportFailure,
  format: FileImportFormat,
  count?: number,
): string {
  const word = format === 'word';
  switch (failure) {
    case 'too-large':
      return 'This file is over 50 MB, more than an import takes.';
    case 'legacy':
      return word
        ? 'This file is password protected or in the older .doc format. Save it as a .docx without a password first.'
        : 'This file is password protected or in the older .ppt format. Save it as a .pptx without a password first.';
    case 'not-a-package':
      return word
        ? "This isn't a Word document (.docx), or it is damaged."
        : "This isn't a PowerPoint deck (.pptx), or it is damaged.";
    case 'wrong-format':
      return word
        ? 'This is a PowerPoint file. Go back and choose PowerPoint to import it.'
        : 'This is a Word file. Go back and choose Word to import it.';
    case 'unpacks-too-large':
      return 'This file unpacks to more than an import takes.';
    case 'too-many-slides':
      return `This deck has ${n(count ?? 0)} slides; a tab holds at most ${n(MAX_PAGES)}.`;
    case 'too-many-blocks':
      return `This document makes ${n(count ?? 0)} blocks; an article holds at most ${n(MAX_ARTICLE_BLOCKS)}.`;
    case 'too-large-for-tab':
      return 'This is more than one page holds. Split it into smaller files and import each into its own page.';
  }
}
