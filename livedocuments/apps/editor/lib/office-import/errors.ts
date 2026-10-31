// The named failures of a Word or PowerPoint import and their copy
// (docs/specs/020-import-export/office-import.md "Errors").

import { MAX_ARTICLE_BLOCKS, MAX_PAGES } from '@livedocuments/document';

export type FileImportFormat = 'word' | 'powerpoint';

export type OfficeImportFailure =
  | 'too-large'
  | 'legacy'
  | 'not-a-package'
  | 'wrong-format'
  | 'unpacks-too-large'
  | 'too-many-slides'
  | 'too-many-blocks'
  | 'too-large-for-tab';

/** Thrown by the readers; `importOfficeFile` turns it into its failure. `count` carries the number a message names. */
export class OfficeImportError extends Error {
  readonly failure: OfficeImportFailure;
  readonly count?: number;
  constructor(failure: OfficeImportFailure, count?: number) {
    super(failure);
    this.name = 'OfficeImportError';
    this.failure = failure;
    if (count !== undefined) this.count = count;
  }
}

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
      return 'This is more than one tab holds. Split it into smaller files and import each into its own tab.';
  }
}
