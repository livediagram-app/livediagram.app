// Real 3D's lawns (docs/specs/008-canvas/3d-engine.md, grass-field.ts): their blades, regrown only when a lawn or what
// covers it changes. Returns them, for the frame loop to sway.

import { useEffect, useRef, type RefObject } from 'react';
import type { CanvasSurface, Element } from '@livehuddle/document';
import { grassField } from '@/lib/real-3d/scene-grass';
import { grassMesh, type GrassMesh } from './grass-field';
import { GRASS_SETTLE_MS } from './real3d-scene-kit';
import type { Real3DEngine } from './useReal3DEngine';

export function useSceneGrass(
  engineRef: RefObject<Real3DEngine | null>,
  elementsRef: RefObject<readonly Element[]>,
  surfaceRef: RefObject<CanvasSurface>,
  lawnKey: string,
): RefObject<GrassMesh | null> {
  // The lawns' blades, regrown only when a lawn or what covers it changes: at once the first time, then once a change
  // settles (growing a big lawn takes tens of ms; a lawn being dragged keeps its old blades until it is let go).
  const grassRef = useRef<GrassMesh | null>(null);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const grow = () => {
      const next = grassMesh(grassField(elementsRef.current, surfaceRef.current));
      const old = grassRef.current;
      if (old) {
        e.scene.remove(old.object);
        old.dispose();
      }
      grassRef.current = next;
      if (next) e.scene.add(next.object);
    };
    if (!grassRef.current) {
      grow();
      return;
    }
    const t = window.setTimeout(grow, GRASS_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [engineRef, elementsRef, surfaceRef, lawnKey]);
  useEffect(
    () => () => {
      const e = engineRef.current;
      const g = grassRef.current;
      if (g) {
        e?.scene.remove(g.object);
        g.dispose();
      }
      grassRef.current = null;
    },
    [engineRef],
  );
  return grassRef;
}
