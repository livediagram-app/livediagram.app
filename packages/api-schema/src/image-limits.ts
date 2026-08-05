// The image upload cap (spec/19), shared because BOTH sides need the same
// number and they need it for different reasons.
//
// The api enforces it: the pre-dispatch Content-Length gate uses this cap on
// the image route, and the route re-checks the decoded bytes, answering
// `file_too_large` with `limitBytes` set from here. So the value is already
// part of the wire contract, not a server-side implementation detail.
//
// The editor pre-validates against it so a user learns their file is too big
// while picking it, rather than after waiting out an upload that ends in a
// 413. That is the whole reason the client holds the number at all — and the
// reason a second hand-written copy is a trap: lower the server cap and the
// editor would happily accept, upload, and fail files it had just approved.
//
// It lives in api-schema, alongside the DTOs, because that package exists for
// exactly this: what the api emits and the editor consumes.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/** The cap as a whole number of MB, for user-facing copy ("Limit is 10 MB"). */
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);

// The formats an upload may declare (spec/19), here for the same reasons as
// the cap above, only more so: the api doesn't merely enforce this list, it
// SERIALISES it — a 415 response carries `acceptedTypes` straight from this
// tuple. That makes it wire contract by definition, and a second hand-written
// copy the same trap as a second cap: add a format server-side and the
// editor's file picker goes on quietly filtering it out, with nothing failing
// to say so.
//
// SVG is absent on purpose and must stay absent. It is XML, it can carry an
// inline <script>, and the api sniffs magic numbers precisely so a declared
// content-type can't smuggle one past this list (apps/api/src/image-sniff.ts).
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

// How each format is written in user-facing copy. Not derivable from the MIME
// string — "image/webp" is shown as "WebP", not "WEBP" — so it's a map, and
// the Record makes adding a format to the tuple a type error until its label
// is supplied.
const IMAGE_TYPE_LABELS: Record<AcceptedImageType, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
};

/** The value for an `<input type="file" accept>` attribute. */
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',');

/**
 * The formats as a prose list ("PNG, JPEG, WebP, or GIF"), for the picker
 * hint and the rejection messages. Derived so the copy can't fall behind the
 * tuple the way three hand-typed copies of it did.
 */
export const IMAGE_TYPES_LABEL = ((labels: string[]) =>
  labels.length < 2
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`)(
  ACCEPTED_IMAGE_TYPES.map((t) => IMAGE_TYPE_LABELS[t]),
);
