// A document in the Trash (docs/specs/013-workspace/trash.md). A cloud canvas in the Trash has no grant, so the api
// answers it as not found; the index tells it from a missing one (its item outlives the trashing), which
// isTrashedInIndex asks. The Offline Mode store throws DocumentTrashedError for a trashed local record, and an
// ApiError carrying `document_trashed` still counts. Callers never care which store said it.

import { DOCUMENT_TRASHED_ERROR } from '@livediagram/api-schema';
import { ApiError } from './api/core';
import { indexClient } from './index-client';

export class DocumentTrashedError extends Error {
  readonly documentId: string;
  constructor(documentId: string) {
    super(`document ${documentId} is in the Trash`);
    this.name = 'DocumentTrashedError';
    this.documentId = documentId;
  }
}

export function isDocumentTrashedError(err: unknown): boolean {
  return (
    err instanceof DocumentTrashedError ||
    (err instanceof ApiError && err.code === DOCUMENT_TRASHED_ERROR)
  );
}

/** Whether the index has this canvas in its Trash, for the person; false when it cannot say. */
export async function isTrashedInIndex(id: string): Promise<boolean> {
  try {
    return (await indexClient.getItem(id)).item.trashedAt !== null;
  } catch {
    return false;
  }
}
