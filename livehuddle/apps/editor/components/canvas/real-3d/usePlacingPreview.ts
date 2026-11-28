// Real 3D's placing preview (docs/specs/008-canvas/3d-view.md "Editing in 3D"): the piece being placed from the palette,
// drawn where it would land, and the walls a door, a window or a fence being placed changes, drawn as they will stand.

import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { placingDrawn, usePlacingPiece } from '@/lib/real-3d/placing-piece';
import { modelled, piecesMesh } from '@/lib/real-3d/scene-pieces';
import { onLawn } from '@/lib/real-3d/scene-grass';
import { wallMesh, wallPalette, type WallPalette } from '@/lib/real-3d/scene-walls';
import { WALL_RISE } from '@/lib/real-3d/models/kit';
import { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import { contactShadows } from './contact-shadows';
import { buildGroup, type SceneState } from './real3d-scene-kit';
import type { Real3DEngine } from './useReal3DEngine';

export function usePlacingPreview(
  engineRef: RefObject<Real3DEngine | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  staticRef: RefObject<SceneState>,
  elements: readonly Element[],
  walls: ReturnType<typeof spaceWalls>,
): void {
  // The piece being placed from the palette, drawn where it would land as it will stand once dropped (3d-view.md
  // "Editing in 3D"): its model and its contact shadow, built on their own, so a pointer move costs that one piece.
  const placing = usePlacingPiece();
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !placing || !modelled(placing)) {
      placingDrawn.set(false);
      return;
    }
    const built = piecesMesh([placing]);
    const group = buildGroup(built, e.mats);
    const kind = placing.shape;
    const grounding = contactShadows(
      built.bounds,
      (x, y) => onLawn(elements, x, y),
      () => kind,
    );
    group.group.add(grounding.object);
    e.scene.add(group.group);
    placingDrawn.set(true);
    return () => {
      e.scene.remove(group.group);
      group.dispose();
      grounding.dispose();
    };
  }, [engineRef, placing, elements]);
  // A door, a window or a fence being placed is part of the walls: the walls it changes are drawn as they will
  // stand with it (the doorway cut, the window glazed, the fence run), in place of the ones standing now, so you see
  // exactly where it lands (the owner, 2026-11-27).
  useEffect(() => {
    const e = engineRef.current;
    const st = staticRef.current;
    if (!e || !placing || modelled(placing)) return;
    const now = new Set(walls.map((w) => JSON.stringify(w)));
    const next = spaceWalls([...elements, placing]).filter((w) => w.kind !== 'grass');
    const nextKeys = new Set(next.map((w) => JSON.stringify(w)));
    const added = next.filter((w) => !now.has(JSON.stringify(w)));
    if (added.length === 0) return;
    const gone = walls.filter((w) => !nextKeys.has(JSON.stringify(w)));
    const tokens =
      canvasRef.current?.parentElement?.querySelector('[data-space-walls]') ??
      canvasRef.current?.parentElement;
    const style = tokens ? getComputedStyle(tokens) : null;
    const palette: WallPalette = wallPalette((n) => style?.getPropertyValue(n) ?? '');
    const root = new THREE.Group();
    const built = added.map((w) => buildGroup(wallMesh(w, palette).rise(WALL_RISE), e.mats));
    for (const b of built) root.add(b.group);
    const hidden: THREE.Group[] = [];
    for (const w of gone) {
      const was = st.walls.get(w.id);
      if (!was) continue;
      for (const g of [was.group, was.low]) {
        if (!g.visible) continue;
        g.visible = false;
        hidden.push(g);
      }
      // Kept out of sight while the new one stands in for it (the cut-away pass would show it again).
      was.group.userData.placingHidden = true;
    }
    e.scene.add(root);
    placingDrawn.set(true);
    return () => {
      e.scene.remove(root);
      built.forEach((b) => b.dispose());
      for (const w of gone) {
        const was = st.walls.get(w.id);
        if (was) delete was.group.userData.placingHidden;
      }
      for (const g of hidden) g.visible = true;
      placingDrawn.set(false);
    };
  }, [engineRef, canvasRef, staticRef, placing, elements, walls]);
  useEffect(() => () => placingDrawn.set(false), []);
}
