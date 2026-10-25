'use client';

// "Import from" on liveworkspace.app's Explorer: the shared Import From host (@liveworkspace/explorer/imports), over
// each app's own address. Reading those files takes the app's editor, so each button opens the app's /import page for
// that source, which imports into the folder (or into Shape Libraries) and comes back here.

import type { ImportHost } from '@liveworkspace/explorer';
import { appImportHref, appImportsHost } from '@liveworkspace/explorer/imports';
import type { AppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';

/** The app's /import page for `source`, landing items at `folderId` or libraries in Shape Libraries. */
export function importHref(
  app: AppName,
  source: string,
  what: 'items' | 'libraries',
  folderId: string | null,
): string | null {
  return appImportHref(app, source, what, folderId, appOrigin(app));
}

/** The app's imports host (stable per app), or undefined where it imports nothing. */
export function importsHost(app: AppName): ImportHost | undefined {
  return appImportsHost(app, appOrigin(app));
}
