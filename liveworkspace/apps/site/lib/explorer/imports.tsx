'use client';

// "Import from" on liveworkspace.app's Explorer (@liveworkspace/explorer's imports host): the tools an app reads files
// from (the sites registry's `imports`). Reading those files takes the app's editor, so each button opens the app's
// /import page for that source, which imports into the folder (or into Shape Libraries) and comes back here.

import type { ReactNode } from 'react';
import type { ImportHost, ImportSource } from '@liveworkspace/explorer';
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';
import {
  DrawioSourceIcon,
  ExcalidrawSourceIcon,
  MsWhiteboardSourceIcon,
} from '@/components/dialogs/import-source-icons';

/** The app's /import page for `source`, landing items at `folderId` or libraries in Shape Libraries. */
export function importHref(
  app: AppName,
  source: string,
  what: 'items' | 'libraries',
  folderId: string | null,
): string | null {
  const path = APP_ITEMS[app].importPath;
  if (!path) return null;
  const params = new URLSearchParams({ source, what });
  if (folderId && what === 'items') params.set('folder', folderId);
  return `${siteOfApp(app).url}${path}?${params}`;
}

const hosts = new Map<AppName, ImportHost | null>();

/** The app's imports host (stable per app), or undefined where it imports nothing. */
export function importsHost(app: AppName): ImportHost | undefined {
  if (!hosts.has(app)) {
    const sources: ImportSource[] = APP_ITEMS[app].imports.map((s) => ({
      id: s.id,
      name: s.name,
      ...(SOURCE_ICONS[s.id] ? { icon: SOURCE_ICONS[s.id] } : {}),
      ...(s.libraries ? { libraries: true } : {}),
    }));
    hosts.set(
      app,
      sources.length && APP_ITEMS[app].importPath
        ? {
            sources,
            onImport: (source, { what, placement }) => {
              const href = importHref(app, source.id, what, placement.folderId);
              if (href) window.location.assign(href);
            },
          }
        : null,
    );
  }
  return hosts.get(app) ?? undefined;
}

// Each source's button, by its id.
const SOURCE_ICONS: Record<string, ReactNode> = {
  'microsoft-whiteboard': <MsWhiteboardSourceIcon />,
  excalidraw: <ExcalidrawSourceIcon />,
  drawio: <DrawioSourceIcon />,
};
