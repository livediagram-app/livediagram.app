// The one check on a path a sign-in (or any round trip) comes back to, for every app's api, editor and liveworkspace's
// site. Only a path on this site passes: anything else (`//evil.example`, `https://…`, `/\evil`) would make the
// return an open redirect. So would a tab, newline or other control character: a browser drops them from a URL it
// follows, so `/<tab>/evil.example` lands on `//evil.example`. A backslash anywhere is refused too, since a browser
// reads it as `/`. Imports nothing, so a page or Worker that takes it pulls in no more than this file.

/** Whether the path holds a C0 control, a space or DEL: a URL parser strips or drops them. */
export function hasControlOrSpace(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Whether the value is an absolute path on this site that no browser could turn into another origin. */
export function isSameSitePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !hasControlOrSpace(value)
  );
}

/** The value when it is a path on this site, else the fallback. */
export function safeReturnPath(value: string | null | undefined, fallback: string): string {
  return isSameSitePath(value) ? value : fallback;
}

/** The path normalised as the browser would resolve it, or null when it is not an unambiguous same-origin path. */
export function sameOriginPath(path: string | null | undefined): string | null {
  if (!isSameSitePath(path)) return null;
  const base = 'https://return.invalid';
  let url: URL;
  try {
    url = new URL(path, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Where an editor's sign-in or sign-up page may send the visitor on: a same-origin path, unchanged by the browser's
 *  normalising, that isn't one of the auth pages themselves. */
export function isPostAuthPath(path: string | null | undefined): path is string {
  const safe = sameOriginPath(path);
  if (safe === null || safe !== path) return false;
  const lower = safe.toLowerCase();
  return !lower.startsWith('/sign-in') && !lower.startsWith('/get-started');
}
