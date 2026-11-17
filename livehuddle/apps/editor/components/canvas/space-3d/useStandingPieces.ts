'use client';

// Which pieces stand up in the 3D view now (docs/specs/008-canvas/3d-view.md "Pieces stand up", "Performance";
// blueprint: 3d-view.md): the standing pieces in the walls' view area carry `data-space-near` on their own boxes, set
// outside React so the board's elements never re-render for it, and cleared when the view flattens. Chosen again
// only when the area or the board changes, never per step.

import { useEffect, useMemo, type RefObject } from 'react';
import type { Element } from '@livehuddle/document';
import type { SpaceArea } from '@/lib/space-3d/space-3d-cutaway';
import {
  SPACE_HANG_LIFT,
  SPACE_NEAR_ATTR,
  SPACE_STANDS_ATTR,
  hangOnWall,
  standingIdsInArea,
} from '@/lib/space-3d/space-3d-pieces';
import { SPACE_WALL_HEIGHT, type SpaceWall } from '@/lib/space-3d/space-3d-walls';

// A wall piece hanging on its wall (3d-view.md "Wall pieces hang on the wall").
const SPACE_HUNG_ATTR = 'data-space-hung';

export function useStandingPieces(
  layer: RefObject<HTMLElement | null>,
  elements: readonly Element[],
  area: SpaceArea,
  walls: readonly SpaceWall[],
): void {
  const near = useMemo(() => standingIdsInArea(elements, area), [elements, area]);
  // The wall pieces that hang on a back wall, by id: how far each one's foot moves up to its wall's line.
  const hung = useMemo(() => {
    const out = new Map<string, number>();
    for (const el of elements) {
      if (!near.has(el.id)) continue;
      const dy = hangOnWall(el, walls);
      if (dy !== null) out.set(el.id, dy);
    }
    return out;
  }, [elements, near, walls]);
  useEffect(() => {
    // The world layer the walls layer sits in holds the element plane.
    const world = layer.current?.parentElement;
    if (!world) return;
    const boxes = world.querySelectorAll<HTMLElement>(`[${SPACE_STANDS_ATTR}]`);
    for (const box of boxes) {
      const id = box.getAttribute('data-element-id');
      if (id && near.has(id)) {
        if (!box.hasAttribute(SPACE_NEAR_ATTR)) box.setAttribute(SPACE_NEAR_ATTR, '');
      } else if (box.hasAttribute(SPACE_NEAR_ATTR)) box.removeAttribute(SPACE_NEAR_ATTR);
      const dy = id ? hung.get(id) : undefined;
      if (dy === undefined) {
        if (box.hasAttribute(SPACE_HUNG_ATTR)) {
          box.removeAttribute(SPACE_HUNG_ATTR);
          box.style.removeProperty('--space-hang-y');
          box.style.removeProperty('--space-hang-scale');
        }
      } else {
        box.setAttribute(SPACE_HUNG_ATTR, '');
        box.style.setProperty('--space-hang-y', `${dy}px`);
        // A piece taller than its wall is drawn no taller than the wall and a little over it.
        const room = SPACE_WALL_HEIGHT + 40 - SPACE_HANG_LIFT;
        box.style.setProperty(
          '--space-hang-scale',
          `${Math.min(1, room / Math.max(1, box.offsetHeight))}`,
        );
      }
    }
  }, [layer, near, hung]);
  // Flat again: every piece lies down (the rule needs the view's attribute too, so this only tidies the boxes). The
  // world is read at mount: by the cleanup the layer's ref is already cleared.
  useEffect(() => {
    const world = layer.current?.parentElement;
    return () => {
      for (const box of world?.querySelectorAll(`[${SPACE_NEAR_ATTR}]`) ?? [])
        box.removeAttribute(SPACE_NEAR_ATTR);
      for (const box of world?.querySelectorAll<HTMLElement>(`[${SPACE_HUNG_ATTR}]`) ?? []) {
        box.removeAttribute(SPACE_HUNG_ATTR);
        box.style.removeProperty('--space-hang-y');
        box.style.removeProperty('--space-hang-scale');
      }
    };
  }, [layer]);
}
