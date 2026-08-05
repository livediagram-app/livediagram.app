// Central input limits for the API — the byte/length bounds that harden the
// worker against hostile or accidental oversized payloads (important ahead of
// opening the API to external token callers). One place so the caps stay
// consistent and tunable. Structural validity of tabs/elements lives in
// @livediagram/diagram (isValidTab); these are the SIZE bounds a structurally
// valid payload must also respect.

// Outer bound on any request body, gated on Content-Length before dispatch so
// a hostile payload that DECLARES its size never reaches a route's req.json().
// It can only ever be that: the gate runs before the body is read, so there is
// nothing to measure when the header is absent, and it deliberately fails open
// there. The per-route caps are what actually bound an undeclared body — see
// bodyExceedsCap at the bottom of this file.
export const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB

// A single uploaded image's raw bytes (spec/19). Larger than MAX_BODY_BYTES,
// so the pre-dispatch gate must use THIS cap on the image-upload route — an
// 8 MB outer bound would silently make the documented 10 MB image limit
// unreachable (and return the generic payload_too_large instead of the image
// route's file_too_large + limitBytes envelope).
//
// Defined in @livediagram/api-schema, not here: the editor pre-validates a
// picked file against the same number, and two copies drift into a client
// that accepts what the server rejects.
export { MAX_IMAGE_BYTES } from '@livediagram/api-schema';

// A single tab's serialized JSON (the element + comment tree). The body cap
// above bounds one request; this bounds one tab specifically.
export const MAX_TAB_BYTES = 4 * 1024 * 1024;

// Human-facing names: diagram / folder / theme / tab.
export const MAX_NAME_LEN = 500;

// A diagram's slide deck (spec/31). Slides hold element REFERENCES, never
// element copies, so a deck stays tiny however large the diagram is: a few
// hundred bytes per slide. 256KB is roughly a thousand slides and exists to
// bound a hostile payload, not to constrain any real deck.
export const MAX_DECK_LEN = 256 * 1024;

// A custom theme's JSON definition (palette + per-shape colours).
export const MAX_THEME_DEF_BYTES = 256 * 1024;

// One change-log entry's JSON (spec/12). The before/after payloads are
// per-gesture element diffs — a few KB in practice — so this bounds a
// hostile near-8MB entry from bloating both storage and the capped list
// response (30 entries per GET).
export const MAX_CHANGE_LOG_ENTRY_BYTES = 256 * 1024;

// Realtime presence identity, broadcast to every connected peer.
export const MAX_PARTICIPANT_NAME_LEN = 120;
export const MAX_COLOR_LEN = 64;

// Share-link password.
export const MAX_PASSWORD_LEN = 256;

// UTF-8 byte length of a string, for size-gating JSON payloads (a char count
// would under-count multi-byte content).
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * The request's declared body size, or `null` when the client didn't give a
 * usable one.
 *
 * This exists because the obvious spelling is wrong in a way that silently
 * disables whatever cap it feeds, and it did so on two routes:
 *
 *     const len = Number(request.headers.get('content-length'));
 *     if (Number.isFinite(len) && len > CAP) reject();
 *
 * `headers.get` returns `null` for an absent header, `Number(null)` is `0`,
 * and `0` IS finite — so a chunked or streamed body measured as zero bytes
 * and sailed through. Empty and malformed headers coerce to `0` / `NaN` and
 * belong on the same side of the fence, so the check is "finite and > 0", and
 * everything else reads as "the client didn't tell us".
 */
export function declaredBodyBytes(request: Request): number | null {
  const declared = Number(request.headers.get('content-length'));
  return Number.isFinite(declared) && declared > 0 ? declared : null;
}

/**
 * Whether an already-parsed JSON body exceeds `cap` bytes.
 *
 * Prefers the declared length, which is the exact byte count when the body IS
 * the JSON and costs nothing to read — worth having on the hot autosave path,
 * one PUT per ~600ms per editor. Falls back to measuring the parsed body when
 * there's no usable header, so the cap holds for every request shape rather
 * than only the well-behaved ones.
 *
 * Trusting a present header is sound here: a client that under-declares gets
 * its body truncated by the runtime (and then fails structural validation),
 * and one that over-declares only trips its own 413. Callers handling raw
 * bytes rather than JSON should re-check after buffering instead — see the
 * image route, which does exactly that.
 */
export function bodyExceedsCap(request: Request, body: unknown, cap: number): boolean {
  return (declaredBodyBytes(request) ?? byteLength(JSON.stringify(body))) > cap;
}
