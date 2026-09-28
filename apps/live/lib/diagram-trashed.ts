// A diagram in the Trash (docs/specs/013-workspace/trash.md). The api answers
// 410 `diagram_trashed` (an ApiError carrying that code); the Offline Mode
// store throws DiagramTrashedError for a trashed local record. Callers ask
// isDiagramTrashedError and never care which store said it.

import { DIAGRAM_TRASHED_ERROR } from '@livediagram/api-schema';
import { ApiError } from './api/core';

export class DiagramTrashedError extends Error {
  readonly diagramId: string;
  constructor(diagramId: string) {
    super(`diagram ${diagramId} is in the Trash`);
    this.name = 'DiagramTrashedError';
    this.diagramId = diagramId;
  }
}

export function isDiagramTrashedError(err: unknown): boolean {
  return (
    err instanceof DiagramTrashedError ||
    (err instanceof ApiError && err.code === DIAGRAM_TRASHED_ERROR)
  );
}
