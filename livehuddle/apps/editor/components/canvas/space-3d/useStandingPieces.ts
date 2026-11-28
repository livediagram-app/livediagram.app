'use client';

// Which flat pieces stand their furniture up in the 3D view now (docs/specs/008-canvas/3d-view.md "Pieces stand up",
// "Performance"; blueprint: 3d-view.md): an Office Pod near the view carries `data-space-near` on its own box, set
// outside React so the board's elements never re-render for it, and cleared when the layer goes. Chosen again only
// when the area or the board changes, never per step. Every other standing piece is the 3D scene's model
// (3d-engine.md), its box hidden, so nothing stands it up or hangs it on a wall any more.

import { useEffect, useMemo, type RefObject } from 'react';
import type { Element } from '@livehuddle/document';
import type { SpaceArea } from '@/lib/space-3d/space-3d-cutaway';
import {
  SPACE_NEAR_ATTR,
  SPACE_STANDS_ATTR,
  standingIdsInArea,
  standsInside3D,
} from '@/lib/space-3d/space-3d-pieces';

export function useStandingPieces(
  layer: RefObject<HTMLElement | null>,
  elements: readonly Element[],
  area: SpaceArea,
): void {
  const near = useMemo(() => {
    const inArea = standingIdsInArea(elements, area);
    const out = new Set<string>();
    for (const el of elements) if (inArea.has(el.id) && standsInside3D(el)) out.add(el.id);
    return out;
  }, [elements, area]);
  useEffect(() => {
    // The world layer the floor layer sits in holds the element plane.
    const world = layer.current?.parentElement;
    if (!world) return;
    for (const box of world.querySelectorAll<HTMLElement>(`[${SPACE_STANDS_ATTR}]`)) {
      const id = box.getAttribute('data-element-id');
      if (id && near.has(id)) {
        if (!box.hasAttribute(SPACE_NEAR_ATTR)) box.setAttribute(SPACE_NEAR_ATTR, '');
      } else if (box.hasAttribute(SPACE_NEAR_ATTR)) box.removeAttribute(SPACE_NEAR_ATTR);
    }
  }, [layer, near]);
  // The layer gone: every piece lies down. The world is read at mount: by the cleanup the layer's ref is cleared.
  useEffect(() => {
    const world = layer.current?.parentElement;
    return () => {
      for (const box of world?.querySelectorAll<HTMLElement>(`[${SPACE_NEAR_ATTR}]`) ?? [])
        box.removeAttribute(SPACE_NEAR_ATTR);
    };
  }, [layer]);
}
