'use client';

// The Library the editor lends the shared Explorer (@liveworkspace/explorer `LibraryHostProps`): the person's Image
// Gallery and Shape Libraries, read through this site's own API with the page's Bearer (the package's
// `appLibraryHosts`, the same hosts liveworkspace.app's Explorer uses), and "Import from" (the shared
// `@liveworkspace/explorer/imports`), whose buttons open this site's /import page for the source (app/import/page.tsx),
// which imports where New was pressed and comes back.

import { appLibraryHosts, type AppLibraryHosts, type ImportHost } from '@liveworkspace/explorer';
import { appImportsHost } from '@liveworkspace/explorer/imports';
import { currentBearer } from './api/core';

/** Import From: livehuddle's sources (the sites registry's), each opening this site's /import page. */
export const explorerImports: ImportHost | undefined = appImportsHost('livehuddle');

/** The Gallery and Shape Libraries over this site's API (same-origin paths), as the page's person (stable for the
 *  page's life). */
export function explorerLibraryHosts(): AppLibraryHosts {
  return appLibraryHosts('livehuddle', { token: currentBearer, origin: '' });
}
