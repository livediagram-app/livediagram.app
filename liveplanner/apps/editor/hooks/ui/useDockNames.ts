'use client';

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useMediaQuery } from '@liveplanner/ui';

// Whether the bottom-right cluster names its buttons beside their icons (docs/specs/007-editor/
// editor-app.md "Named on a wide desktop"): only from this width up. Narrower, a laptop's canvas
// would lose its lower middle to the names (at 1280 px the named strips reach x 446), so the
// buttons stay icons, as on a phone.
const DOCK_NAMES_MIN_WIDTH = 1440;
const QUERY = `(min-width: ${DOCK_NAMES_MIN_WIDTH}px)`;

// The reader's Settings > Appearance > Button Labels (`dockButtonNames`), on outside a provider. It
// names the editor's bottom buttons: the footer bar's (Search, Settings, the theme) and, on a wide
// screen, the bottom-right cluster's. A phone shows them as icons whatever it says.
const DockNamesSetting = createContext(true);

/** The Button Labels setting itself, for a surface with its own width rule (the footer bar). */
export function useButtonLabelsSetting(): boolean {
  return useContext(DockNamesSetting);
}

export function DockNamesProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return createElement(DockNamesSetting.Provider, { value }, children);
}

export function useDockNames(): boolean {
  const wide = useMediaQuery(QUERY);
  return useContext(DockNamesSetting) && wide;
}
