// How this person views a photo page (docs/specs/031-photo/photo-pages.md "Navigating"): the pixel grid
// past PIXEL_GRID_FROM screen px a photo px, on by default, toggled from the command palette. Kept in this
// browser; a view, never an edit.
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'livedesign:photo-view';

type ViewOptions = { pixelGrid: boolean };
const DEFAULTS: ViewOptions = { pixelGrid: true };

let state: ViewOptions | null = null;
const listeners = new Set<() => void>();

function current(): ViewOptions {
  if (state) return state;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<ViewOptions>) : {};
    state = { pixelGrid: typeof v.pixelGrid === 'boolean' ? v.pixelGrid : DEFAULTS.pixelGrid };
  } catch {
    state = DEFAULTS;
  }
  return state;
}

export const photoViewOptions = {
  get: current,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(patch: Partial<ViewOptions>): void {
    state = { ...current(), ...patch };
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // A full or blocked store: the view still changes for the session.
    }
    for (const fn of listeners) fn();
  },
};

export function usePhotoViewOptions(): ViewOptions {
  return useSyncExternalStore(
    (fn) => photoViewOptions.subscribe(fn),
    current,
    () => DEFAULTS,
  );
}
