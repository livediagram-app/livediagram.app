import { DAY_MS } from '@livediagram/items';
// The Trash (docs/specs/013-workspace/trash.md): a deleted document waits 30
// days before it is purged. One clock for the api's daily purge, the Trash
// view's "days left" and the Offline Mode local Trash.

// How long a document stays restorable. Operator decision; changing it changes
// what the Trash view and the help article promise.
export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * DAY_MS;

// How long a document must sit empty and unsaved before the daily clean-up
// moves it to the Trash (docs/specs/013-workspace/empty-document-cleanup.md).
// Operator decision; the help article promises it.
export const EMPTY_DOCUMENT_STALE_DAYS = 30;
export const EMPTY_DOCUMENT_STALE_MS = EMPTY_DOCUMENT_STALE_DAYS * DAY_MS;

// Why a document is in the Trash: someone deleted it, or the clean-up moved it
// because it stayed empty. The database stores NULL for `deleted`.
export const TRASH_REASONS = ['deleted', 'empty'] as const;
export type TrashReason = (typeof TRASH_REASONS)[number];

// The error every door answers for a document that is in the Trash, to a
// caller who could have opened it (HTTP 410).
export const DOCUMENT_TRASHED_ERROR = 'document_trashed';

// The WebSocket close code the realtime room ends a session with when its
// document is trashed. In the 4000-4999 application range, beside 4003
// (a share link changed).
export const DOCUMENT_TRASHED_CLOSE = 4004;

// One row of `GET /api/trash`: a document the caller may restore or purge.
export type TrashedDocument = {
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

export function trashPurgeDueAt(trashedAt: number): number {
  return trashedAt + TRASH_RETENTION_MS;
}

export function isTrashExpired(trashedAt: number, now: number): boolean {
  return now >= trashPurgeDueAt(trashedAt);
}

// Whole days until the purge is due, rounded up and never below zero: 30 the
// moment a document is deleted, 1 on its last day.
export function trashDaysLeft(trashedAt: number, now: number): number {
  return Math.max(0, Math.ceil((trashPurgeDueAt(trashedAt) - now) / DAY_MS));
}
