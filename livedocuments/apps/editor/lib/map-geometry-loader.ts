'use client';

// The map's geometry, loaded on demand (docs/specs/009-elements/map.md "Geometry"; blueprint
// `map-geometry-loader.ts`): one dynamic import, cached for the session and provided to the document
// package so the synchronous renderers (thumbnails, minimap, exports) draw it too. Nothing loads
// until a map draws, the Map dialog opens, or a tab with a map is exported.

import { useEffect, useSyncExternalStore } from 'react';
import {
  provideMapGeometry,
  providedMapGeometry,
  type Element,
  type MapGeometry,
} from '@livedocuments/document';

let pending: Promise<MapGeometry | null> | null = null;
const listeners = new Set<() => void>();

/** Load the geometry once; a failed load (offline first visit) resolves null and is tried again next time. */
export function loadMapGeometry(): Promise<MapGeometry | null> {
  const ready = providedMapGeometry();
  if (ready) return Promise.resolve(ready);
  pending ??= import('@livedocuments/document/map-geometry')
    .then((m) => {
      provideMapGeometry(m.MAP_GEOMETRY);
      for (const l of listeners) l();
      return m.MAP_GEOMETRY;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

const hasMap = (elements: readonly Element[]) =>
  elements.some((el) => el.type === 'shape' && el.shape === 'map');

/** Before an export or a picture of a tab: load the geometry if any element is a map. */
export async function ensureMapGeometryFor(elements: readonly Element[]): Promise<void> {
  if (hasMap(elements)) await loadMapGeometry();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The geometry for a component that draws a map: null until it has loaded (draw the placeholder). */
export function useMapGeometry(): MapGeometry | null {
  const geometry = useSyncExternalStore(subscribe, providedMapGeometry, () => null);
  useEffect(() => {
    if (!geometry) void loadMapGeometry();
  }, [geometry]);
  return geometry;
}

/**
 * For a picture of some elements (a page thumbnail, an export preview): loads the geometry only when one of
 * them is a map, and answers it once loaded, so the picture redraws with the land instead of the placeholder.
 * A tab with no map never fetches it.
 */
export function useMapGeometryFor(elements: readonly Element[]): MapGeometry | null {
  const geometry = useSyncExternalStore(subscribe, providedMapGeometry, () => null);
  const needed = !geometry && hasMap(elements);
  useEffect(() => {
    if (needed) void loadMapGeometry();
  }, [needed]);
  return geometry;
}
