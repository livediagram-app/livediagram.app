// "Import from" for an app's items, wherever its Explorer runs (the app's own address or liveworkspace.app): the tools
// the app reads files from (the sites registry's `imports`), each with its button, and Import, which opens the app's
// /import page for that source. That page imports into the folder (or into Shape Libraries) and comes back.

import type { ReactNode } from 'react';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import {
  DrawioSourceIcon,
  ExcalidrawSourceIcon,
  MsWhiteboardSourceIcon,
} from './import-source-icons';
import type { ImportHost, ImportSource } from './types';

export { DrawioSourceIcon, ExcalidrawSourceIcon, MsWhiteboardSourceIcon };

/** Each source's button, by its registry id. */
export const IMPORT_SOURCE_ICONS: Readonly<Record<string, ReactNode>> = {
  'microsoft-whiteboard': <MsWhiteboardSourceIcon />,
  excalidraw: <ExcalidrawSourceIcon />,
  drawio: <DrawioSourceIcon />,
};

/** The app's /import page for `source`, landing items at `folderId` or libraries in Shape Libraries; `origin` is the
 *  app's (empty on the app's own address). Null for an app with no /import page. */
export function appImportHref(
  app: AppName,
  source: string,
  what: 'items' | 'libraries',
  folderId: string | null,
  origin = '',
): string | null {
  const path = APP_ITEMS[app].importPath;
  if (!path) return null;
  const params = new URLSearchParams({ source, what });
  if (folderId && what === 'items') params.set('folder', folderId);
  return `${origin}${path}?${params}`;
}

const hosts = new Map<string, ImportHost | null>();

/** The app's Import From host (the same object for each app and origin, so the Explorer's props stay stable), or
 *  undefined where the app imports nothing. */
export function appImportsHost(app: AppName, origin = ''): ImportHost | undefined {
  const key = `${app} ${origin}`;
  if (!hosts.has(key)) {
    const sources: ImportSource[] = APP_ITEMS[app].imports.map((s) => ({
      id: s.id,
      name: s.name,
      ...(IMPORT_SOURCE_ICONS[s.id] ? { icon: IMPORT_SOURCE_ICONS[s.id] } : {}),
      ...(s.libraries ? { libraries: true } : {}),
    }));
    hosts.set(
      key,
      sources.length && APP_ITEMS[app].importPath
        ? {
            sources,
            onImport: (source, { what, placement }) => {
              const href = appImportHref(app, source.id, what, placement.folderId, origin);
              if (href) window.location.assign(href);
            },
          }
        : null,
    );
  }
  return hosts.get(key) ?? undefined;
}
