'use client';

// Roofs on the rooms that stand on Grass (docs/specs/008-canvas/3d-view.md "Rooms on grass have roofs"), in the walls
// layer's 3D space: two slopes and two gable ends on each room's wall tops, ghosted (app/space-3d.css). The one over
// your feet is marked inside, and goes, as you walk in: set on the node, so a step never re-renders the layer.

import { useEffect, useMemo, useRef } from 'react';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import type { AvatarPose } from '@livehuddle/avatar/pose';
import type { SpaceArea } from '@/lib/space-3d/space-3d-cutaway';
import { roofOver, roofShape, roofsInArea, type SpaceRoof } from '@/lib/space-3d/space-3d-roofs';

export function Space3DRoofs({
  roofs,
  area,
  poseStore,
}: {
  roofs: readonly SpaceRoof[];
  area: SpaceArea;
  poseStore: ReadableStore<AvatarPose>;
}) {
  const drawn = useMemo(() => roofsInArea(roofs, area), [roofs, area]);
  const nodes = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    let over: string | null = null;
    const apply = () => {
      const next = roofOver(drawn, poseStore.get().pos);
      if (next === over) return;
      if (over) nodes.current.get(over)?.removeAttribute('data-inside');
      if (next) nodes.current.get(next)?.setAttribute('data-inside', '');
      over = next;
    };
    apply();
    return poseStore.subscribe(apply);
  }, [drawn, poseStore]);
  return (
    <>
      {drawn.map((roof) => (
        <Roof
          key={roof.id}
          roof={roof}
          nodeRef={(node) => {
            if (node) nodes.current.set(roof.id, node);
            else nodes.current.delete(roof.id);
          }}
        />
      ))}
    </>
  );
}

function Roof({ roof, nodeRef }: { roof: SpaceRoof; nodeRef: (node: HTMLElement | null) => void }) {
  const { length, span, rise, slant, pitch, base } = roofShape(roof);
  // Along the ridge on its own x axis; a roof whose ridge runs down the plan is turned a quarter onto it.
  const place = roof.across
    ? `translate(${roof.x + roof.width}px, ${roof.y}px) rotate(90deg)`
    : `translate(${roof.x}px, ${roof.y}px)`;
  return (
    <div
      ref={nodeRef}
      data-space-roof=""
      // On the wall tops (up off the floor is +z here); each slope tips up from its eaves to the ridge.
      style={{ transform: `${place} translateZ(${base}px)` }}
    >
      <div
        data-space-roof-slope=""
        style={{
          width: length,
          height: slant,
          transformOrigin: '0 0',
          transform: `rotateX(${pitch}deg)`,
        }}
      />
      <div
        data-space-roof-slope=""
        data-far=""
        style={{
          width: length,
          height: slant,
          top: span - slant,
          transformOrigin: '0 100%',
          transform: `rotateX(${-pitch}deg)`,
        }}
      />
      {[0, length].map((at) => (
        <div
          key={at}
          data-space-roof-gable=""
          style={{
            left: at,
            top: -rise,
            width: span,
            height: rise,
            transformOrigin: '0 100%',
            transform: 'rotateZ(90deg) rotateX(-90deg)',
          }}
        />
      ))}
    </div>
  );
}
