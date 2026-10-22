// Whether a photo tools rail is on screen now (PhotoToolsRail sets it while it is mounted), for the
// framing that makes room beside it (hooks/editor/usePhotoFraming.ts): the canvas's chrome can be held
// back (a visitor's Join prompt) while the photo page is already in focus. A tiny store, so the editor
// can read it without loading the photo editor.
import { useSyncExternalStore } from 'react';

let shown = 0;
const listeners = new Set<() => void>();

export const railShown = {
  get: (): boolean => shown > 0,
  /** A rail mounted; the returned function is its unmount. */
  mount(): () => void {
    shown++;
    for (const fn of listeners) fn();
    return () => {
      shown--;
      for (const fn of listeners) fn();
    };
  },
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useRailShown(): boolean {
  return useSyncExternalStore(railShown.subscribe, railShown.get, () => false);
}
