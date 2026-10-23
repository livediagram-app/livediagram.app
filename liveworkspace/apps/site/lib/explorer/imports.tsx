'use client';

// "Import from" on liveworkspace.app's Explorer (@liveworkspace/explorer's imports host): the tools an app reads files
// from (the sites registry's `imports`). Reading those files takes the app's editor, so each button opens the app's
// /import page for that source, which imports into the folder (or into Shape Libraries) and comes back here.

import type { ReactNode } from 'react';
import type { ImportHost, ImportSource } from '@liveworkspace/explorer';
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';

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

// The sources' buttons, as livediagram's editor draws them (its import-source-icons.tsx): original glyphs, not the
// vendors' logos; nothing here ships a vendor trademark mark.
function MsWhiteboardSourceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#2b6fd6" />
      <rect
        x="4.5"
        y="5"
        width="11"
        height="8.5"
        rx="1"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
      />
      <path
        d="M6.3 11c1-2.2 2-2.2 2.6-.7s1.6 1.5 2.5-.4 1.6-1.6 2.3-.2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 13.5v2.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ExcalidrawSourceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#6965db" />
      <path
        d="M4.6 6.2c2-.4 4.2-.5 6.3-.3M4.8 6c-.2 2-.1 4.1.1 6.1M5 12.2c1.8.2 3.6.2 5.3 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10.6 14.6l1-2.9 4.2-4.2a1.1 1.1 0 0 1 1.6 1.6l-4.2 4.2z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DrawioSourceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#c2410c" />
      <rect
        x="3.8"
        y="4.2"
        width="6.4"
        height="4.2"
        rx="0.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
      />
      <path d="M7 8.4v4.4h3.4" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M13.4 10.2l2.6 2.6-2.6 2.6-2.6-2.6z" fill="#fff" />
    </svg>
  );
}

const SOURCE_ICONS: Record<string, ReactNode> = {
  'microsoft-whiteboard': <MsWhiteboardSourceIcon />,
  excalidraw: <ExcalidrawSourceIcon />,
  drawio: <DrawioSourceIcon />,
};
