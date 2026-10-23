// The Explorer lives on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"), once for every app. Every
// address under liveplanner's old /explorer goes there, keeping its path, query and hash and naming liveplanner as
// where the person came from, so the Explorer shows liveplanner's logo and opens on its plans. In production the
// editor worker answers it with a 302 before any HTML is served (src/worker.ts); the /explorer pages' client
// replace covers the dev server, where that worker isn't in front.

import { explorerUrl } from '@liveworkspace/sites';

export const OLD_EXPLORER_PATH = '/explorer';

export const isOldExplorerPath = (pathname: string) =>
  pathname === OLD_EXPLORER_PATH || pathname.startsWith(`${OLD_EXPLORER_PATH}/`);

/** The liveworkspace Explorer's address for an old liveplanner /explorer address. */
export function explorerRedirectUrl(pathname: string, search = '', hash = ''): string {
  const tail = pathname.slice(OLD_EXPLORER_PATH.length).replace(/^\/+|\/+$/g, '');
  return explorerUrl('liveplanner', tail, search, hash);
}

/** The liveworkspace Explorer at `path` (Home by default), opened from liveplanner. */
export const liveworkspaceExplorer = (path = '', search = '') =>
  explorerUrl('liveplanner', path, search);
