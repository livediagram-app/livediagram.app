// The Explorer is liveworkspace's, served under livedesign's own address (liveworkspace/docs/one-explorer.md "The
// Explorer on each app's address"): livedesign's router answers /explorer/* with liveworkspace's Explorer page, the
// address bar unchanged (@liveworkspace/sites/workspace-proxy), so every link to it stays on this origin and the
// person's session, offline designs and colours come along. The editor itself serves no /explorer page.

/** The Explorer at `path` under /explorer (`''` for Home), with `search`. */
export function explorerHref(path = '', search = ''): string {
  const tail = path.replace(/^\/+|\/+$/g, '');
  const query = search.replace(/^\?/, '');
  return `/explorer${tail ? `/${tail}` : ''}${query ? `?${query}` : ''}`;
}
