'use client';

// The host's Library and imports (./types), read by the sidebar, the panes, the menus and the panel. Apart from the
// core context so a host without any of it costs nothing: the defaults are empty.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LibraryHostProps } from './types';

export type LibraryHost = LibraryHostProps & { history: boolean };

const NONE: LibraryHost = { history: true };
const Ctx = createContext<LibraryHost>(NONE);

export function useLibraryHost(): LibraryHost {
  return useContext(Ctx);
}

/** Whether the Library holds any page of the host's. */
export const hasLibrary = (host: LibraryHostProps) => Boolean(host.gallery || host.shapeLibraries);

export function LibraryHostProvider({
  gallery,
  shapeLibraries,
  imports,
  itemMenu,
  history = true,
  onCreateTeam,
  children,
}: LibraryHostProps & { children: ReactNode }) {
  const value = useMemo<LibraryHost>(
    () => ({ gallery, shapeLibraries, imports, itemMenu, history, onCreateTeam }),
    [gallery, shapeLibraries, imports, itemMenu, history, onCreateTeam],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
