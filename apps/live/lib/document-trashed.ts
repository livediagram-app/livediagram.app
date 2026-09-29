// A diagram in the Trash (docs/specs/013-workspace/trash.md). The api answers
// 410 `diagram_trashed` (an ApiError carrying that code); the Offline Mode
// store throws DiagramTrashedError for a trashed local record. Callers ask
// isDiagramTrashedError and never care which store said it.

import { DOCUMENT_TRASHED_ERROR } from '@livediagram/api-schema';
import { ApiError } from './api/core';

export class DocumentTrashedError extends Error {
  readonly documentId: string;
  constructor(documentId: string) {
    super(`diagram ${documentId} is in the Trash`);
    this.name = 'DiagramTrashedError';
    this.documentId = documentId;
  }
}

export function isDocumentTrashedError(err: unknown): boolean {
  return (
    err instanceof DocumentTrashedError ||
    (err instanceof ApiError && err.code === DOCUMENT_TRASHED_ERROR)
  );
}
