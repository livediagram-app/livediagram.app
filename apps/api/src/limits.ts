// Central input limits for the API — the byte/length bounds that harden the
// worker against hostile or accidental oversized payloads (important ahead of
// opening the API to external token callers). One place so the caps stay
// consistent and tunable. Structural validity of tabs/elements lives in
// @livediagram/document (isValidTab); these are the SIZE bounds a structurally
// valid payload must also respect.

// Outer bound on any request body, gated on Content-Length before dispatch so
// a hostile payload that DECLARES its size never reaches a route's req.json().
// It can only ever be that: the gate runs before the body is read, so there is
// nothing to measure when the header is absent, and it deliberately fails open
// there. The per-route caps are what actually bound an undeclared body — see
// bodyExceedsCap at the bottom of this file.
export const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB

// A single uploaded image's raw bytes (docs/specs/009-elements/images.md). Larger than MAX_BODY_BYTES,
// so the pre-dispatch gate must use THIS cap on the image-upload route — an
// 8 MB outer bound would silently make the documented 10 MB image limit
// unreachable (and return the generic payload_too_large instead of the image
// route's file_too_large + limitBytes envelope).
//
// Defined in @livediagram/api-schema, not here: the editor pre-validates a
// picked file against the same number, and two copies drift into a client
// that accepts what the server rejects.
export { MAX_IMAGE_BYTES } from '@livediagram/api-schema';

// A single tab's data (the element + comment tree), held to D1's row cap less headroom
// (docs/specs/015-api/api.md "Tab size"). Defined in @livediagram/api-schema, so the editor checks
// the same number before it sends. The body cap above bounds one request; this bounds one tab.
export {
  D1_MAX_ROW_BYTES,
  MAX_TAB_BYTES,
  tabDataBytes,
  tabTooLarge,
} from '@livediagram/api-schema';
import { MAX_TAB_BYTES as MAX_TAB_BYTES_CAP } from '@livediagram/api-schema';

/**
 * A tab write refused for size at the storage layer (db/tabs.ts): every route that stores a tab
 * catches it and answers the named 413, so nothing reaches D1 that D1 would refuse.
 */
/** The one log line for a tab refused for size: `[tab-size] refused`, its write, bytes and cap. */
export function logTabRefused(write: string, tabId: string, bytes: number): void {
  console.warn('[tab-size] refused', { write, tabId, bytes, cap: MAX_TAB_BYTES_CAP });
}

/** Runs a tab write; false when the storage layer refused it for size (the caller answers 413). */
export async function storeTab(write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (error) {
    if (error instanceof TabTooLargeError) return false;
    throw error;
  }
}

export class TabTooLargeError extends Error {
  readonly tabId: string;
  readonly bytes: number;
  readonly write: string;
  constructor(tabId: string, bytes: number, write: string) {
    super(`tab ${tabId} is ${bytes} bytes, over the tab cap`);
    this.name = 'TabTooLargeError';
    this.tabId = tabId;
    this.bytes = bytes;
    this.write = write;
  }
}

// Human-facing names outside the document / tab name cap: folder / theme / API
// token / OAuth client. Document and tab names are shortened to the far tighter
// NAME_MAX_LENGTH instead (names.ts, docs/specs/006-document/name-length.md).
export const MAX_NAME_LEN = 500;

// A document's slide deck (docs/specs/012-collaboration/presentation-mode.md). Slides hold element REFERENCES, never
// element copies, so a deck stays tiny however large the document is: a few
// hundred bytes per slide. 256KB is roughly a thousand slides and exists to
// bound a hostile payload, not to constrain any real deck.
export const MAX_DECK_LEN = 256 * 1024;

// A custom theme's JSON definition (palette + per-shape colours).
export const MAX_THEME_DEF_BYTES = 256 * 1024;

// The client-claimed document-write key relayed on presence (docs/specs/012-collaboration/participant-responses.md). Real
// ones are UUIDs; the clamp only stops a hostile hello pushing an oversize
// string into the socket attachment, which has a small hard budget.
export const MAX_PARTICIPANT_KEY_LEN = 64;

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
