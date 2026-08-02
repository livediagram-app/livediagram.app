// Tiny safe wrappers around window.localStorage for the three (and
// counting) persistence modules in the live app that previously
// open-coded the same boilerplate: useUiMode, useShortcutsEnabled,
// user-preferences. Each was doing the same `typeof window` guard +
// the same try/catch around setItem with the same "quota / private
// browsing" comment. Centralising means the SSR-safety guarantee and
// the failure semantics ("a write that throws is swallowed; the in-
// memory state still applies for the session") live in one file the
// next reader can find.
//
// The helpers stay primitive-only (strings) on purpose so they don't
// take a stance on serialisation. Callers parse / stringify whatever
// shape they want above this layer; the trade-off here is between
// "one helper, every caller, simple" and "typed JSON wrapper that
// fights with three different parsing rules" — the three call sites
// have meaningfully different read semantics (literal string match,
// 'false' sentinel, JSON object with forward-compat key preservation)
// so a generic JSON helper would just add layers.
//
// `safeJson` below is the one exception, and it earned the exception
// by evidence rather than argument: five later config modules (avatar,
// laser, spotlight, eraser, format) each grew a byte-identical copy of
// it. It is deliberately only the PARSE step, not a `readJson(key)`
// that folds the read in — the read semantics really do still differ
// per caller, which is what the paragraph above is about.

// Read a string from window.localStorage. Returns null when:
//   1. We're rendering server-side (typeof window === 'undefined'),
//   2. The key is missing,
//   3. The browser denied the read (Safari private mode + storage
//      partitioning under iframes can throw on getItem too, not
//      just setItem).
// The caller decides what to default to when null comes back.
export function readLocalStorageSafe(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Write a string to window.localStorage. Silently no-ops on SSR or
// when the write throws (quota exceeded, private-window restriction,
// storage partitioning). Callers that need to react to the failure
// should check `readLocalStorageSafe` on the next render to confirm
// the value landed; today's three callers all accept the "session-
// only" degradation as their failure mode.
export function writeLocalStorageSafe(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage quota / private browsing: in-memory only.
  }
}

// Remove a key from window.localStorage. Silently no-ops on SSR or when
// the removal throws (same private-browsing / partitioning hazards as the
// read + write above). Used by callers that clear persisted state, e.g.
// the guest-identity module on sign-in migration.
export function removeLocalStorageSafe(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // SSR / private browsing: nothing persisted to remove anyway.
  }
}

// Parse a string read out of storage, treating malformed JSON as absent.
// Anything in localStorage is untrusted input: it survives across releases,
// a user can edit it by hand, and another tab may have written a shape from
// a different version. A throw here would take down the caller's whole
// hydration for a value it was going to default anyway.
export function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
