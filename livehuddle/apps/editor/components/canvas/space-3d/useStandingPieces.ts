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
  screenRoomOnWall,
  standingIdsInArea,
  standsRaised,
} from '@/lib/space-3d/space-3d-pieces';
import { SPACE_WALL_HEIGHT, type SpaceWall } from '@/lib/space-3d/space-3d-walls';
import { turnQuarter } from '@/lib/space-3d/space-3d-turn';
import { useSpace3DTurn } from './useSpace3DView';

// A wall piece hanging on its wall (3d-view.md "Wall pieces hang on the wall"): flat on it (no value) while the camera
// looks at the wall's face, or standing out from it facing the camera like a blade sign (`blade`) once the camera
// turns, so its words never run sideways or back to front (the owner, 2026-11-18: room signs' text "is rotated").
const SPACE_HUNG_ATTR = 'data-space-hung';

export function useStandingPieces(
  layer: RefObject<HTMLElement | null>,
  elements: readonly Element[],
  area: SpaceArea,
  walls: readonly SpaceWall[],
): void {
  const near = useMemo(() => standingIdsInArea(elements, area), [elements, area]);
  const blade = turnQuarter(useSpace3DTurn()) !== 0 ? 'blade' : '';
  // The pieces standing on a Stage, by id: they rise with its top (3d-view.md "A stage stands up").
  const raised = useMemo(() => {
    const stages = elements.filter(
      (el): el is Extract<Element, { type: 'shape' }> =>
        el.type === 'shape' && el.shape === 'stage',
    );
    const out = new Set<string>();
    if (stages.length === 0) return out;
    for (const el of elements) {
      if (!near.has(el.id) || el.type !== 'shape' || el.shape === 'stage') continue;
      if (standsRaised(stages, { x: el.x + el.width / 2, y: el.y + el.height })) out.add(el.id);
    }
    return out;
  }, [elements, near]);
  // The wall pieces that hang on a back wall, by id: how far each one's foot moves up to its wall's line.
  const hung = useMemo(() => {
    const out = new Map<string, { dy: number; width: number | null }>();
    for (const el of elements) {
      if (!near.has(el.id)) continue;
      const dy = hangOnWall(el, walls);
      if (dy !== null) out.set(el.id, { dy, width: screenRoomOnWall(el, walls, dy) });
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
      if (id && raised.has(id)) box.style.setProperty('--space-raise', 'var(--space-stage-lift)');
      else box.style.removeProperty('--space-raise');
      const hang = id ? hung.get(id) : undefined;
      if (hang === undefined) {
        if (box.hasAttribute(SPACE_HUNG_ATTR)) {
          box.removeAttribute(SPACE_HUNG_ATTR);
          box.style.removeProperty('--space-hang-y');
          box.style.removeProperty('--space-hang-scale');
        }
      } else {
        box.setAttribute(SPACE_HUNG_ATTR, blade);
        box.style.setProperty('--space-hang-y', `${hang.dy}px`);
        // A piece taller than its wall is drawn smaller, so it hangs inside the wall with a hand's width over it.
        const room = SPACE_WALL_HEIGHT - SPACE_HANG_LIFT - 12;
        const tall = room / Math.max(1, box.offsetHeight);
        // A Screen grows to fill its wall, as tall as the wall allows and as wide as its run of wall (3d-view.md "Wall
        // pieces hang on the wall").
        const scale =
          hang.width === null
            ? Math.min(1, tall)
            : Math.max(
                Math.min(1, tall),
                Math.min(tall, hang.width / Math.max(1, box.offsetWidth)),
              );
        box.style.setProperty('--space-hang-scale', `${scale}`);
      }
    }
  }, [layer, near, hung, blade, raised]);
  // Flat again: every piece lies down (the rule needs the view's attribute too, so this only tidies the boxes). The
  // world is read at mount: by the cleanup the layer's ref is already cleared.
  useEffect(() => {
    const world = layer.current?.parentElement;
    return () => {
      for (const box of world?.querySelectorAll<HTMLElement>(`[${SPACE_NEAR_ATTR}]`) ?? []) {
        box.removeAttribute(SPACE_NEAR_ATTR);
        box.style.removeProperty('--space-raise');
      }
      for (const box of world?.querySelectorAll<HTMLElement>(`[${SPACE_HUNG_ATTR}]`) ?? []) {
        box.removeAttribute(SPACE_HUNG_ATTR);
        box.style.removeProperty('--space-hang-y');
        box.style.removeProperty('--space-hang-scale');
      }
    };
  }, [layer]);
}
