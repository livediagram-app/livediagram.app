'use client';

// The 3D view's standing walls (docs/specs/008-canvas/3d-view.md "What it shows", "Walls in front of you are cut
// away", "Performance"; blueprint: 3d-view.md): inside the canvas's world layer, so they pan and zoom with the floor,
// each one element folding up from its line on the floor. Built once per board change; only the walls near the view
// are drawn, chosen again when the view has moved far; the walls in front of your feet fade, written straight to the
// DOM from your pose, so a step renders nothing here. Loaded the first time a walk wants the 3D view.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { AvatarPose } from '@livehuddle/avatar/pose';
import type { Element } from '@livehuddle/document';
import {
  SPACE_DOOR_HEIGHT,
  spaceWalls,
  wallFrame,
  type SpaceWall,
} from '@/lib/space-3d/space-3d-walls';
import {
  areaMovedFar,
  cutAwayIds,
  viewArea,
  wallsInArea,
  type SpaceArea,
} from '@/lib/space-3d/space-3d-cutaway';
import { useStandingPieces } from './useStandingPieces';

export function Space3DWalls({
  elements,
  poseStore,
  size,
}: {
  elements: readonly Element[];
  poseStore: ReadableStore<AvatarPose>;
  size: { width: number; height: number };
}) {
  const walls = useMemo(() => spaceWalls(elements), [elements]);
  const viewport = useViewportStore();
  const [area, setArea] = useState<SpaceArea>(() => viewArea(viewport.get(), size));
  // The drawn area follows the view, but only re-renders this layer when the view has moved far.
  useEffect(() => {
    const check = () => {
      const next = viewArea(viewport.get(), size);
      setArea((prev) => (areaMovedFar(prev, next) ? next : prev));
    };
    check();
    return viewport.subscribe(check);
  }, [viewport, size]);
  const drawn = useMemo(() => wallsInArea(walls, area), [walls, area]);
  // The pieces in the same area stand up (3d-view.md "Pieces stand up"), marked on their own boxes.
  const layer = useRef<HTMLDivElement>(null);
  useStandingPieces(layer, elements, area, walls);
  // The cut-away, from every pose, outside React: each wall's node by id, and the ids cut now.
  const nodes = useRef(new Map<string, HTMLElement>());
  const cut = useRef(new Set<string>());
  useEffect(() => {
    const apply = () => {
      const next = cutAwayIds(drawn, poseStore.get().pos);
      for (const id of cut.current)
        if (!next.has(id)) nodes.current.get(id)?.removeAttribute('data-cut');
      for (const id of next)
        if (!cut.current.has(id)) nodes.current.get(id)?.setAttribute('data-cut', '');
      cut.current = next;
    };
    // A redrawn layer starts with no wall cut: forget what the old nodes carried.
    cut.current = new Set();
    apply();
    return poseStore.subscribe(apply);
  }, [drawn, poseStore]);
  return (
    <div
      ref={layer}
      aria-hidden
      data-space-walls=""
      className="pointer-events-none absolute left-0 top-0"
    >
      {drawn.map((wall) => (
        <Wall
          key={wall.id}
          wall={wall}
          nodeRef={(node) => {
            if (node) nodes.current.set(wall.id, node);
            else nodes.current.delete(wall.id);
          }}
        />
      ))}
    </div>
  );
}

function Wall({ wall, nodeRef }: { wall: SpaceWall; nodeRef: (node: HTMLElement | null) => void }) {
  const { x, y, length, angle } = wallFrame(wall);
  return (
    <div
      ref={nodeRef}
      data-space-wall={wall.kind}
      style={{
        width: length,
        transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
        ['--wall-h' as string]: `${wall.height}px`,
        ['--wall-shade' as string]: `${Math.round(wall.shade * 100)}%`,
        ['--door-h' as string]: `${SPACE_DOOR_HEIGHT}px`,
      }}
    >
      <div data-space-wall-face="" data-shut={wall.shut ? '' : undefined}>
        {wall.kind === 'window' ? <span data-space-window-pane="" /> : null}
        {wall.kind === 'doorway' ? (
          <span data-space-door-frame="">
            {wall.shut ? <span data-space-door-leaf="" /> : null}
          </span>
        ) : null}
        {wall.label ? <span data-space-wall-label="">{wall.label}</span> : null}
      </div>
    </div>
  );
}
