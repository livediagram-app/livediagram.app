// The Explorer is liveworkspace's, served under liveplanner's own address (liveworkspace/docs/one-explorer.md "The
// Explorer on each app's address"): liveplanner's router answers /explorer/* with liveworkspace's Explorer page, the
// address bar unchanged, so every link to it stays on this origin and the person's session, offline plans and
// colours come along. The editor itself serves no /explorer page.

/** The Explorer at `path` (Home by default), with `search` (`?…`) as given. */
export const explorerHref = (path = '', search = ''): string =>
  `/explorer${path ? `/${path.replace(/^\/+/, '')}` : ''}${search}`;
