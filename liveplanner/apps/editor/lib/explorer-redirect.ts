// The Explorer lives on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"), once for every app. Every
// address under liveplanner's old /explorer goes there, keeping its path, query and hash and naming liveplanner as
// where the person came from (@liveworkspace/sites `oldExplorerRedirectUrl`). In production the editor worker answers
// it with a 302 before any HTML is served (src/worker.ts); the /explorer pages' client replace covers the dev server.

import { explorerUrl, oldExplorerRedirectUrl } from '@liveworkspace/sites';

export { OLD_EXPLORER_PATH, isOldExplorerPath } from '@liveworkspace/sites';

/** The liveworkspace Explorer's address for an old liveplanner /explorer address. */
export const explorerRedirectUrl = (pathname: string, search = '', hash = ''): string =>
  oldExplorerRedirectUrl('liveplanner', pathname, search, hash);

/** The liveworkspace Explorer at `path` (Home by default), opened from liveplanner. */
export const liveworkspaceExplorer = (path = '', search = '') =>
  explorerUrl('liveplanner', path, search);
