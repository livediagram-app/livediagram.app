// Where livedesign's Explorer is: liveworkspace's shared Explorer (liveworkspace/docs/site.md "The Explorer"), which
// livedesign's router serves at livedesign's own /explorer (@liveworkspace/sites/workspace-proxy), so every link here
// opens it there.
// EXPLORER_ON_LIVEWORKSPACE is the one switch: on, the editor worker answers every /explorer address with a 302 to
// the same place on liveworkspace.app (`@liveworkspace/sites` oldExplorerRedirectUrl), naming livedesign, and these
// links go there directly.
import { explorerUrl, isOldExplorerPath, oldExplorerRedirectUrl } from '@liveworkspace/sites';

export const EXPLORER_ON_LIVEWORKSPACE = false;

export { isOldExplorerPath };

/** The liveworkspace Explorer's address for an old livedesign /explorer address. */
export const explorerRedirectUrl = (pathname: string, search = '', hash = ''): string =>
  oldExplorerRedirectUrl('livedesign', pathname, search, hash);

/** The Explorer at `path` under /explorer (`''` for Home), with `search`. */
export function explorerHref(path = '', search = ''): string {
  if (EXPLORER_ON_LIVEWORKSPACE) return explorerUrl('livedesign', path, search);
  const tail = path.replace(/^\/+|\/+$/g, '');
  const query = search.replace(/^\?/, '');
  return `/explorer${tail ? `/${tail}` : ''}${query ? `?${query}` : ''}`;
}
