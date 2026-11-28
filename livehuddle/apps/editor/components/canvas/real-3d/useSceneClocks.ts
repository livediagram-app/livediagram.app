// Real 3D's Clocks (docs/specs/009-elements/social-pieces.md "Clock"): their hands moved once a minute.

import { useEffect, type RefObject } from 'react';
import type { Element } from '@livehuddle/document';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';
import { buildGroup, type SceneState } from './real3d-scene-kit';
import type { Real3DEngine } from './useReal3DEngine';

export function useSceneClocks(
  engineRef: RefObject<Real3DEngine | null>,
  staticRef: RefObject<SceneState>,
  elements: readonly Element[],
  pieceBase: readonly Element[],
  paletteKey: string,
): void {
  // Clocks tick once a minute (social-pieces.md "Clock"), at the viewer's own time: at each minute their models alone are built
  // again over the frozen ones, so their hands move without rebuilding the board. Nothing runs between minutes.
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const clocks = elements.filter((el) => el.type === 'shape' && el.shape === 'world-clock');
    if (!clocks.length) return;
    const st = staticRef.current;
    let drawn: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      drawn?.();
      const restore = clocks.map((el) => st.lift(el.id));
      const group = buildGroup(piecesMesh(clocks, elements), e.mats);
      e.scene.add(group.group);
      drawn = () => {
        e.scene.remove(group.group);
        group.dispose();
        restore.forEach((f) => f());
      };
    };
    const next = () => {
      timer = setTimeout(
        () => {
          draw();
          next();
        },
        60_000 - (Date.now() % 60_000) + 20,
      );
    };
    next();
    return () => {
      clearTimeout(timer);
      drawn?.();
    };
  }, [engineRef, staticRef, elements, pieceBase, paletteKey]);
}
