'use client';

// The canvas's tab menu opener, for surfaces drawn over the canvas that stop its right-clicks: a board filling its tab or maximised opens the same tab menu from its empty
// space. Null where there is no menu (read-only).
import { createContext, useContext } from 'react';

export const CanvasMenu = createContext<((x: number, y: number) => void) | null>(null);

export function useCanvasMenu(): ((x: number, y: number) => void) | null {
  return useContext(CanvasMenu);
}
