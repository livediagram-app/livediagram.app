// A design in the Trash (docs/specs/013-workspace/trash.md). The api answers
// 410 `design_trashed` (an ApiError carrying that code); the Offline Mode
// store throws DesignTrashedError for a trashed local record. Callers ask
// isDesignTrashedError and never care which store said it.

import { DESIGN_TRASHED_ERROR } from '@livedesign/api-schema';
import { ApiError } from './api/core';

export class DesignTrashedError extends Error {
  readonly designId: string;
  constructor(designId: string) {
    super(`design ${designId} is in the Trash`);
    this.name = 'DesignTrashedError';
    this.designId = designId;
  }
}

export function isDesignTrashedError(err: unknown): boolean {
  return (
    err instanceof DesignTrashedError ||
    (err instanceof ApiError && err.code === DESIGN_TRASHED_ERROR)
  );
}
