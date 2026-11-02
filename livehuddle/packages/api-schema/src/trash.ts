// The Trash (docs/specs/013-workspace/trash.md): a deleted document waits 30 days before it is purged. The
// clock, the reasons and the row are liveworkspace's (@liveworkspace/api-schema/trash); what carries
// this product's noun is here.

import { DAY_MS } from '@liveworkspace/api-schema/within-reach';

export * from '@liveworkspace/api-schema/trash';

// How long a document must sit empty and unsaved before the daily clean-up
// moves it to the Trash (docs/specs/013-workspace/empty-document-cleanup.md).
// Operator decision; the help article promises it.
export const EMPTY_DOCUMENT_STALE_DAYS = 30;
export const EMPTY_DOCUMENT_STALE_MS = EMPTY_DOCUMENT_STALE_DAYS * DAY_MS;

// The error every door answers for a document that is in the Trash, to a
// caller who could have opened it (HTTP 410).
export const DOCUMENT_TRASHED_ERROR = 'document_trashed';

// The WebSocket close code the realtime room ends a session with when its
// document is trashed. In the 4000-4999 application range, beside 4003
// (a share link changed).
export const DOCUMENT_TRASHED_CLOSE = 4004;
