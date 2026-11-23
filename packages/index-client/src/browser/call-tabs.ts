// The call's own browser tab (liveworkspace/docs/specs/004-index/item-calls.md "Starting", owner 2026-11-22: a new
// tab, never the item's). Named for the item (itemCallTabName), so Call and Join bring back the tab already in the call
// rather than open a second; the item's tab is named too (itemTabName), so the call's Open Item brings it back.
//
// `window.open('', name)` finds the named tab, or opens a blank one. A blank one is ours (same origin, about:blank):
// it is sent on to the call, its opener cut. One already in the call is livehuddle's (another origin), so reading
// where it is throws: it is only focused.
import { itemTabName } from '../item-calls';

/** A tab named `name`: the one there, or a new blank one. Opened in the press itself, so no popup blocker stops it. */
export function namedTab(name: string): Window | null {
  return window.open('', name);
}

/** Whether `tab` is a fresh blank tab (ours to send somewhere), not one already at the call. */
export function isBlank(tab: Window): boolean {
  try {
    return tab.location.href === 'about:blank';
  } catch {
    // Another origin's: already somewhere.
    return false;
  }
}

/** A share link (`?s=`) by way of its app's no-click sign-in (`/api/auth/silent?return=`), else `url` unchanged.
 *  A page never bounces a share link itself (@liveworkspace/auth-client/silent), so without this someone signed in to
 *  liveworkspace would reach the call as a guest on their first visit to livehuddle; a guest comes straight back. */
export function viaSilentSignIn(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (!u.searchParams.has('s')) return url;
  return `${u.origin}/api/auth/silent?return=${encodeURIComponent(u.pathname + u.search + u.hash)}`;
}

/** Sends a blank tab to `url` (a share link by way of the no-click sign-in), its opener cut so the call can't reach
 *  back into the item's tab. */
export function sendTab(tab: Window, url: string): void {
  try {
    tab.opener = null;
  } catch {
    // Some browsers keep it read-only; the call's own page drops it.
  }
  tab.location.href = viaSilentSignIn(url);
}

/** The tab named `name`: brought forward when it is already somewhere, else sent to `url`. False when blocked. */
export function focusOrOpen(name: string, url: string): boolean {
  const tab = namedTab(name);
  if (!tab) return false;
  if (isBlank(tab)) sendTab(tab, url);
  else tab.focus();
  return true;
}

/** Names this tab for the item it shows, unless the page already named it something of its own. */
export function nameItemTab(itemId: string): void {
  if (window.name === '' || window.name.startsWith('lw-item-')) window.name = itemTabName(itemId);
}
