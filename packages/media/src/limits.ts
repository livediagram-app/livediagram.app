// What an upload may be (liveworkspace/docs/specs/006-media/media.md "Uploads"). The service enforces these, and each
// app's editor checks the same numbers before it uploads, so a person hears their file is too big while
// picking it rather than after the upload fails. Both read them from here so they can't drift.

// The largest file the service stores. Well above a phone photo (2 to 4 MB) or a 4K screenshot, well
// below a Worker's request limit.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** The cap as a whole number of MB, for copy ("Limit is 10 MB"). */
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);

// The formats an upload may be. The service serialises this list in its 415 answer, so it is part of
// the contract. SVG is absent on purpose and must stay absent: it is XML and can carry a script, which
// is why the service sniffs every upload's first bytes rather than trusting its declared type.
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export function isAcceptedImageType(value: unknown): value is AcceptedImageType {
  return typeof value === 'string' && (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(value);
}

// The longest original file name kept, in characters. R2's custom metadata holds 2 KB in all.
export const ORIGINAL_NAME_MAX = 200;

// An image's opaque ids (owners, documents, images) are bounded so a request can't grow a row without
// limit.
export const MEDIA_ID_MAX = 200;

// The most documents one reference sync carries, and the most images one document may name in it.
export const MEDIA_REFS_SYNC_MAX = 500;
export const MEDIA_REFS_PER_DOCUMENT_MAX = 1000;
