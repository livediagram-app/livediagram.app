// Whether a return path from the URL (`?redirect_url`, `?return`) stays on
// this origin. A plain `startsWith('/')` check is not enough: browsers strip
// tabs and newlines and read `\` as `/`, so `/\t/evil.com` or `/\evil.com`
// becomes `//evil.com` by the time it is navigated. Shared by the auth pages
// and the Drive consent round-trip.

// Control characters and whitespace (U+0000 to U+0020, U+007F).
function hasControlOrSpace(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

// The path normalised as the browser would resolve it, or null when it is
// not an unambiguous same-origin absolute path.
export function sameOriginPath(path: string | null | undefined): string | null {
  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    hasControlOrSpace(path)
  ) {
    return null;
  }
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
