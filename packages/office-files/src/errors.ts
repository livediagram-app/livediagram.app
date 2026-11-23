// The named failures of a Word or PowerPoint import (livedocuments/docs/specs/020-import-export/office-import.md
// "Errors"), and the error the readers throw. What each failure says to a person is the product's own: its
// apps/editor/lib/office-import/errors.ts words them, with the limits of its own model.

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

/** Thrown by the readers; a product's `importOfficeFile` turns it into its failure. `count` carries the number a
 *  message names. */
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
