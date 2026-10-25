// The Trash (docs/specs/013-workspace/trash.md): a deleted design waits 30 days before it is purged. The
// clock, the reasons and the row are liveworkspace's (@liveworkspace/api-schema/trash); what carries
// this product's noun is here.

import type { TrashReason } from '@liveworkspace/api-schema/trash';

export {
  TRASH_REASONS,
  TRASH_RETENTION_DAYS,
  TRASH_RETENTION_MS,
  isTrashExpired,
  trashDaysLeft,
  trashPurgeDueAt,
  type TrashReason,
} from '@liveworkspace/api-schema/trash';

// One row of `GET /api/trash`: a design the caller may restore or purge. The row is every product's
// (TrashedDocument in @liveworkspace/api-schema/trash); it is declared here so the api's OpenAPI
// document keeps naming it `TrashedDesign`.
export type TrashedDesign = {
  id: string;
  name: string;
  // The team whose Trash holds it, or null for the caller's personal Trash.
  teamId: string | null;
  teamName: string | null;
  // When it was deleted, and when the daily purge becomes due (epoch ms).
  trashedAt: number;
  purgeAt: number;
  reason: TrashReason;
};

// How long a design must sit empty and unsaved before the daily clean-up
// moves it to the Trash (docs/specs/013-workspace/empty-design-cleanup.md).
// Operator decision; the help article promises it.
export const EMPTY_DESIGN_STALE_DAYS = 30;

// The error every door answers for a design that is in the Trash, to a
// caller who could have opened it (HTTP 410).
export const DESIGN_TRASHED_ERROR = 'design_trashed';

// The WebSocket close code the realtime room ends a session with when its
// design is trashed. In the 4000-4999 application range, beside 4003
// (a share link changed).
export const DESIGN_TRASHED_CLOSE = 4004;
