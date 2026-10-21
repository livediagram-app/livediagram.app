'use client';

import { memo } from 'react';
import { AVATAR_PAD_GRID, AVATAR_PAD_PARTS, type AvatarPadPart } from '@liveplanner/document';

// An Avatar Pad (docs/specs/009-elements/avatar-pad.md): the pixel teleport platform where Avatar-mode characters
// start. Drawn from the shared `AVATAR_PAD_PARTS` table, which the headless export draws too, on the sprite's own
// coarse grid: the viewBox IS the grid, scaled whole into the box (`meet`) with crisp edges, so a resized pad scales
// its pixels and never smears them. The ring of light and the side lamps shimmer on a stepped loop
// (`avatar-pad-shimmer` in canvas-motion.css), off under reduced motion.

const BODY = AVATAR_PAD_PARTS.filter((p) => p.role === 'body' || p.role === 'core');
const LIGHTS = AVATAR_PAD_PARTS.filter((p) => p.role === 'ring' || p.role === 'lamp');

const run = (p: AvatarPadPart, i: number) => (
  <rect key={i} x={p.x} y={p.y} width={p.width} height={1} fill={p.fill} />
);

export const AvatarPadView = memo(function AvatarPadView() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        viewBox={`0 0 ${AVATAR_PAD_GRID.width} ${AVATAR_PAD_GRID.height}`}
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Avatar Pad"
        data-avatar-pad=""
      >
        {BODY.map(run)}
        <g className="avatar-pad-shimmer">{LIGHTS.map(run)}</g>
      </svg>
    </div>
  );
});
