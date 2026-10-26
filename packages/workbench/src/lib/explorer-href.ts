// The Explorer is liveworkspace's, served under each app's own address (liveworkspace/docs/specs/004-index/one-explorer.md "The
// Explorer on each app's address"): the app's router answers /explorer/* with liveworkspace's Explorer page, the
// address bar unchanged (@liveworkspace/sites/workspace-proxy), so every link to it stays on this origin and the
// person's session, offline work and colours come along. The editor itself serves no /explorer page.

/** The Explorer at `path` under /explorer (`''` for Home), with `search`. */
export function explorerHref(path = '', search = ''): string {
  const tail = path.replace(/^\/+|\/+$/g, '');
  const query = search.replace(/^\?/, '');
  return `/explorer${tail ? `/${tail}` : ''}${query ? `?${query}` : ''}`;
}
