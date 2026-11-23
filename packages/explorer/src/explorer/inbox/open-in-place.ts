// Open in the app from the Inbox's reading pane, when the row's place is on the page already open
// (one-explorer-contracts.md "Inbox"): the editor's own panel, its item's row. Its address then differs from this
// page's only in its fragment (the tab, the element, the popover), and a link to it moves the fragment and nothing
// else: a client router pushes it as a hash change, the browser scrolls to it, and an editor reads its deep link once,
// as it opens. So the address changed and the page stayed as it was. Such an open is a page load of the address, which
// the editor then lands as it lands any deep link.

/** Whether `href` names this page, `here`, but for its fragment: the same origin, path (a trailing slash aside) and
 *  query. */
export function sameDocument(href: string, here: Location | URL): boolean {
  let to: URL;
  try {
    to = new URL(href, here.href);
  } catch {
    return false;
  }
  const path = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  return (
    to.origin === here.origin &&
    path(to.pathname) === path(here.pathname) &&
    to.search === here.search
  );
}

type Win = Pick<Window, 'location' | 'history'>;

/** A plain click on the pane's Open link (not one opening a new tab or window) whose address is this page's: loads it
 *  in full. The address replaces the current history entry, as the editors' own tab switches do, since the editors
 *  never follow a Back that only moves the fragment. Answers whether it did; any other click is left to the link. */
export function openInPlace(
  event: Pick<
    MouseEvent,
    'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented' | 'preventDefault'
  >,
  href: string,
  win: Win = window,
): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!sameDocument(href, win.location)) return false;
  event.preventDefault();
  const to = new URL(href, win.location.href).href;
  if (to !== win.location.href) win.history.replaceState(null, '', to);
  win.location.reload();
  return true;
}
