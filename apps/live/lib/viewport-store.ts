// The editor's view (pan offset and zoom), held apart from its render state
// (docs/specs/008-canvas/canvas-performance.md "A pan or zoom renders the canvas, not the editor"):
// one store per editor, read by what shows the view and by handlers when they run. Setters are shaped
// as React's setState; a set that changes nothing notifies nobody. Not logged per change: a wheel
// tick is a hot path.

import type { SetStateAction } from 'react';

export type Point = { x: number; y: number };
export type View = { readonly zoom: number; readonly offset: Point };

export type ViewportStore = {
  get(): View;
  subscribe(listener: () => void): () => void;
  setZoom(next: SetStateAction<number>): void;
  setOffset(next: SetStateAction<Point>): void;
  setView(next: View): void;
};

export function createViewportStore(zoom: number): ViewportStore {
  let current: View = { zoom, offset: { x: 0, y: 0 } };
  const listeners = new Set<() => void>();
  const commit = (next: View) => {
    if (
      next.zoom === current.zoom &&
      next.offset.x === current.offset.x &&
      next.offset.y === current.offset.y
    ) {
      return;
    }
    current = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setZoom(next) {
      commit({ ...current, zoom: typeof next === 'function' ? next(current.zoom) : next });
    },
    setOffset(next) {
      commit({ ...current, offset: typeof next === 'function' ? next(current.offset) : next });
    },
    setView: commit,
  };
}
