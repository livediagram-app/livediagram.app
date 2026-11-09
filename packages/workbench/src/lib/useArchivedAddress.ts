// The file an editor's address names, and whether this browser holds it archived (./archived.ts): read once, in the
// browser only, so an archived one never opens. A store snapshot rather than a `typeof window` guard in render
// (react-state-and-effects.md "Rendering in the browser only"): the prerender and hydration see no file, and the
// browser's first commit sees the address's, before any effect opens it.
import { useState, useSyncExternalStore } from 'react';
import type { App } from '@liveworkspace/index-client';
import { archivedInThisBrowser } from './archived';

export type ArchivedAddress = { id: string | null; here: boolean };

const NONE: ArchivedAddress = { id: null, here: false };
const subscribe = () => () => {};
const none = () => NONE;

/** `idOf` reads the file's id from a path. Asked once per mount; the answer never changes while it is mounted. */
export function useArchivedAddress(
  app: App,
  idOf: (path: string) => string | null,
): ArchivedAddress {
  // Read once, on mount: a later `idOf` or `app` is the same address.
  const [read] = useState(() => {
    let seen: ArchivedAddress | null = null;
    return () => {
      if (!seen) {
        const id = idOf(window.location.pathname);
        seen = { id, here: archivedInThisBrowser(app, id) };
      }
      return seen;
    };
  });
  return useSyncExternalStore(subscribe, read, none);
}
