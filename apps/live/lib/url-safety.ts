// URL safety for user-entered link addresses (docs/specs/014-identity/auth-and-guest-access.md — security). A `url`
// link is stored on an element / table cell / link-card and FOLLOWED by other
// viewers of a shared diagram, so an unsafe scheme is a stored-XSS vector:
// `window.open('javascript:...')` executes in our origin (noopener doesn't stop
// it). We allow only http / https / mailto, refusing javascript:, data:,
// vbscript:, file:, etc. — enforced both at store time (normaliseUrl) and at
// follow time (isSafeFollowUrl) as defence-in-depth for older / bypassing data.

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// Normalise a user-entered address for storage. Prepends `https://` to a bare
// host (no scheme), then returns the address only when its scheme is allowed;
// null for an empty or unsafe-scheme input. Preserves the entered string (so
// the unfurl cache keys stay stable) rather than re-serialising via URL.href.
export function normaliseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }
  return SAFE_SCHEMES.has(u.protocol.toLowerCase()) ? withScheme : null;
}

// Is an already-stored url link safe to open? Applied at follow time so a
// payload that predates this guard (or arrived via some other path) still
// can't execute.
export function isSafeFollowUrl(raw: string): boolean {
  try {
    return SAFE_SCHEMES.has(new URL(raw).protocol.toLowerCase());
  } catch {
    return false;
  }
}
