// Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer"): with the
// person's common `autoOpenExplorer` setting on, an app's homepage (and liveworkspace.app's) opens their Explorer
// instead. The setting lives in the account, which a homepage view must never wait for, so the page that reads or
// writes it (an editor's preferences, the Settings panel's store, the Explorer) mirrors it into one small
// first-party cookie on the address it runs on, and the router answers the homepage from that cookie alone: a header
// string test, no fetch.
//
// Dependency-free: the routers import the redirect, the browsers the cookie sync.

/** The cookie's name. Host-only, on the app's own address, so it never travels to another app. */
export const OPEN_EXPLORER_COOKIE = 'lw_open_explorer';

/** 400 days, the longest a browser keeps a cookie; every read of the setting writes it again. */
export const OPEN_EXPLORER_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** Where the homepage sends the person: the Explorer's Home on the same address (`explorerHomeHref`). */
export const OPEN_EXPLORER_TARGET = '/explorer/home';

const PAIR = `${OPEN_EXPLORER_COOKIE}=1`;

/** Whether a Cookie header carries the switch, as its own pair (`lw_open_explorer=1`, not `xlw_open_explorer=1`). */
export function hasOpenExplorerCookie(header: string | null): boolean {
  return hasPair(header, PAIR);
}

function hasPair(header: string | null, pair: string): boolean {
  if (!header) return false;
  return header.split(';').some((part) => part.trim() === pair);
}

/** Whether a request is a person arriving on the homepage from outside the site: a typed address, a bookmark, another
 *  site's link. A link inside the site (`Sec-Fetch-Site: same-origin`, or a same-origin Referer where the
 *  browser sends no Sec-Fetch-Site) is someone who means to see the homepage, so it is left be. */
function arrivesFromOutside(request: Request, url: URL): boolean {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site !== null) return site !== 'same-origin';
  const referer = request.headers.get('Referer');
  return !referer || !referer.startsWith(`${url.origin}/`);
}

export type OpenExplorerOptions = {
  // The product's signed-in hint cookie (`SIGNED_IN_HINT_COOKIE` in its api-schema, `1` while this browser has a
  // session): given, the homepage opens the Explorer only for a person signed in, so signing out brings the homepage
  // back without touching the switch.
  signedInCookie?: string;
};

/** The homepage's redirect to the Explorer, or null. Only `GET /` exactly, with no query (`/?home`, or any other
 *  query, always shows the homepage), as a page navigation, from outside the site, with the cookie set (and the
 *  signed-in hint, when named). Never cached: the same address answers the homepage to everyone else. */
export function openExplorerRedirect(
  request: Request,
  url: URL,
  options: OpenExplorerOptions = {},
): Response | null {
  if (request.method !== 'GET' || url.pathname !== '/' || url.search !== '') return null;
  const dest = request.headers.get('Sec-Fetch-Dest');
  if (dest !== null && dest !== 'document') return null;
  const cookies = request.headers.get('Cookie');
  if (!hasOpenExplorerCookie(cookies)) return null;
  if (options.signedInCookie && !hasPair(cookies, `${options.signedInCookie}=1`)) return null;
  if (!arrivesFromOutside(request, url)) return null;
  return new Response(null, {
    status: 302,
    headers: { Location: OPEN_EXPLORER_TARGET, 'Cache-Control': 'no-store', Vary: 'Cookie' },
  });
}

/** The Set-Cookie value (as `document.cookie` takes it) that turns the switch on or off on this address. */
export function openExplorerCookie(on: boolean, secure: boolean): string {
  const tail = `; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
  return on
    ? `${PAIR}; Max-Age=${OPEN_EXPLORER_MAX_AGE_SECONDS}${tail}`
    : `${OPEN_EXPLORER_COOKIE}=; Max-Age=0${tail}`;
}

type CookieDocument = { cookie: string; location: { protocol: string } };

/** Mirrors the setting into this address's cookie: set while on, cleared while off. Called wherever the page reads
 *  or writes the person's settings, so a change made in another app or on another device lands here on the next
 *  read. A no-op outside a browser, and when the cookie already says so. */
export function syncOpenExplorerCookie(
  on: boolean,
  // Read off globalThis, so a Worker that imports this module (with no DOM types) still compiles.
  doc: CookieDocument | undefined = (globalThis as { document?: CookieDocument }).document,
): void {
  if (!doc) return;
  try {
    // On, it is written again to renew its age; off, only when there is one to clear.
    if (!on && !hasOpenExplorerCookie(doc.cookie)) return;
    doc.cookie = openExplorerCookie(on, doc.location.protocol === 'https:');
  } catch {
    // A sandboxed frame or a browser refusing cookies: the homepage simply stays the homepage.
  }
}

/** The same rule as a page's first script, for a site with no router in front of its homepage (liveworkspace.app, a
 *  static site): before anything paints, the homepage with no query, opened from outside the site with the cookie
 *  set, replaces itself with the Explorer, so Back skips it. No signed-in hint there: the Explorer asks a signed-out
 *  person to sign in. */
export function openExplorerBootScript(): string {
  return (
    '(function(){try{' +
    "if(location.pathname!=='/'||location.search)return;" +
    "var r=document.referrer;if(r&&r.indexOf(location.origin+'/')===0)return;" +
    `if(!document.cookie.split(';').some(function(p){return p.trim()===${JSON.stringify(PAIR)}}))return;` +
    `location.replace(${JSON.stringify(OPEN_EXPLORER_TARGET)});` +
    '}catch(e){}})();'
  );
}
