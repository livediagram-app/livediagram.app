// A flag on an editor address or share link that opens the editor in a way (docs/specs/007-editor/wireframe-pages.md
// "A link that opens with Inspect", "Sharing a prototype"): `inspect`, `prototype`. Read once as the editor opens;
// never stored.

/** Whether an address carries the flag (`?<param>`, `?<param>=1`; never `?<param>=0` or `=false`). */
export function wantsFlag(search: string, param: string): boolean {
  const params = new URLSearchParams(search);
  if (!params.has(param)) return false;
  const v = params.get(param);
  return v !== '0' && v !== 'false';
}

/** A link with the flag added as `<param>=1` (kept once if it is already there). */
export function withFlag(href: string, param: string): string {
  const url = new URL(href, 'https://placeholder.invalid');
  url.searchParams.set(param, '1');
  // A relative href stays relative.
  return href.startsWith('/') && !href.startsWith('//')
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}
