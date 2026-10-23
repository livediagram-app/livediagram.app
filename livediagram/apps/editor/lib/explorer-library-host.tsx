'use client';

// The Library the editor lends the shared Explorer (@liveworkspace/explorer `LibraryHostProps`): the person's Image
// Gallery and Shape Libraries, read through this site's own API with the page's Bearer (the package's
// `appLibraryHosts`, the same hosts liveworkspace.app's Explorer uses), and "Import from", whose buttons open this
// site's /import page for the source (app/import/page.tsx), which imports where New was pressed and comes back.

import {
  appLibraryHosts,
  type AppLibraryHosts,
  type ImportHost,
  type ImportSource,
} from '@liveworkspace/explorer';
import { APP_ITEMS } from '@liveworkspace/sites';
import { IMPORT_SOURCES } from '@/app/import/import-sources';
import { currentBearer } from './api/core';

const ITEMS = APP_ITEMS.livediagram;

/** The /import page for `source`, landing canvases at `folderId` or libraries in Shape Libraries. */
export function importHref(
  source: string,
  what: 'items' | 'libraries',
  folderId: string | null,
): string {
  const params = new URLSearchParams({ source, what });
  if (folderId && what === 'items') params.set('folder', folderId);
  return `${ITEMS.importPath ?? '/import'}?${params}`;
}

const SOURCES: ImportSource[] = ITEMS.imports.map((s) => {
  const icon = IMPORT_SOURCES.find((own) => own.id === s.id)?.icon;
  return {
    id: s.id,
    name: s.name,
    ...(icon ? { icon } : {}),
    ...(s.libraries ? { libraries: true } : {}),
  };
});

export const explorerImports: ImportHost = {
  sources: SOURCES,
  onImport: (source, { what, placement }) =>
    window.location.assign(importHref(source.id, what, placement.folderId)),
};

/** The Gallery and Shape Libraries over this site's API (same-origin paths), as the page's person (stable for the
 *  page's life). */
export function explorerLibraryHosts(): AppLibraryHosts {
  return appLibraryHosts('livediagram', { token: currentBearer, origin: '' });
}
