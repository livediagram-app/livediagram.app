// A project in the Trash (docs/specs/013-workspace/trash.md). The api answers
// 410 `project_trashed` (an ApiError carrying that code); the Offline Mode
// store throws ProjectTrashedError for a trashed local record. Callers ask
// isProjectTrashedError and never care which store said it.

import { PROJECT_TRASHED_ERROR } from '@liveplanner/api-schema';
import { ApiError } from './api/core';

export class ProjectTrashedError extends Error {
  readonly projectId: string;
  constructor(projectId: string) {
    super(`project ${projectId} is in the Trash`);
    this.name = 'ProjectTrashedError';
    this.projectId = projectId;
  }
}

export function isProjectTrashedError(err: unknown): boolean {
  return (
    err instanceof ProjectTrashedError ||
    (err instanceof ApiError && err.code === PROJECT_TRASHED_ERROR)
  );
}
