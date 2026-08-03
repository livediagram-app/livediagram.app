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
