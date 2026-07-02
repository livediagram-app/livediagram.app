// Central input limits for the API — the byte/length bounds that harden the
// worker against hostile or accidental oversized payloads (important ahead of
// opening the API to external token callers). One place so the caps stay
// consistent and tunable. Structural validity of tabs/elements lives in
// @livediagram/diagram (isValidTab); these are the SIZE bounds a structurally
// valid payload must also respect.

// Outer bound on any request body, gated on Content-Length before dispatch so
// a hostile payload never reaches a route's req.json().
export const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB

// A single uploaded image's raw bytes (spec/19). Larger than MAX_BODY_BYTES,
// so the pre-dispatch gate must use THIS cap on the image-upload route — an
// 8 MB outer bound would silently make the documented 10 MB image limit
// unreachable (and return the generic payload_too_large instead of the image
// route's file_too_large + limitBytes envelope).
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// A single tab's serialized JSON (the element + comment tree). The body cap
// above bounds one request; this bounds one tab specifically.
export const MAX_TAB_BYTES = 4 * 1024 * 1024;

// Human-facing names: diagram / folder / theme / tab.
export const MAX_NAME_LEN = 500;

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
