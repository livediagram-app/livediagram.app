'use client';

import { memo } from 'react';
import { AVATAR_PALETTE, tint } from '@livedesign/document';
import type { PadArrival } from '@/lib/avatar-pad';

// The arrival beams (docs/specs/009-elements/avatar-pad.md "The arrival"): a column of pixel light in the arriving
// person's colour dropping onto the pad, a flash across the pad's top and square sparks lifting out of it. Drawn in
// canvas coordinates at the feet, inside the transformed wrapper, in front of the characters so the figure seems to
// materialise inside the light. The motion is canvas-motion.css's (stepped, pixel-style), hidden entirely under
// reduced motion: the character then simply appears.

// The beam's box in canvas px: wider than a Regular character and rising well past a Tall one, so the light reads as
// a column from the sky rather than a glow round the feet.
const BEAM_W = 80;
const BEAM_H = 200;
// The grid the beam is drawn on: one unit is two canvas px, the sprite's own chunkiness.
const GRID_W = BEAM_W / 2;
const GRID_H = BEAM_H / 2;
// The beam's foot, in grid units from the top: the feet sit here, the floor flash across it.
const FOOT = GRID_H - 3;
const MID = GRID_W / 2;
// The beam fades out toward the sky in pixel bands rather than a smooth gradient: [top, opacity].
const BANDS: readonly (readonly [number, number])[] = [
  [0, 0.25],
  [10, 0.5],
  [22, 0.8],
  [36, 1],
];
// Where the sparks start (grid units) and how big each is.
const SPARKS: readonly { x: number; y: number; size: number }[] = [
  { x: 11, y: 86, size: 2 },
  { x: 27, y: 80, size: 1 },
  { x: 16, y: 70, size: 1 },
  { x: 30, y: 90, size: 2 },
  { x: 8, y: 76, size: 1 },
  { x: 23, y: 88, size: 2 },
];
// The floor flash: a pixel ring thrown out across the pad's top, like the shock of a landing. Each row of the ellipse
// is its two ends (the top and bottom rows run across), worked out once. It is wider than the beam box, which it
// overflows on purpose.
const FLASH_RX = 20;
const FLASH_RY = 4.5;
const FLASH_RUNS: readonly { x: number; y: number; width: number; inner: boolean }[] = (() => {
  const runs: { x: number; y: number; width: number; inner: boolean }[] = [];
  for (let dy = -4; dy <= 4; dy++) {
    const half = Math.round(FLASH_RX * Math.sqrt(1 - (dy / FLASH_RY) ** 2));
    const edge = Math.abs(dy) === 4;
    if (edge) runs.push({ x: MID - half, y: FOOT + dy, width: half * 2, inner: false });
    else {
      runs.push({ x: MID - half, y: FOOT + dy, width: 3, inner: false });
      runs.push({ x: MID + half - 3, y: FOOT + dy, width: 3, inner: false });
      // A lit core across the middle row, where the feet land.
      if (dy === 0) runs.push({ x: MID - half + 3, y: FOOT, width: half * 2 - 6, inner: true });
    }
  }
  return runs;
})();

export const AvatarPadArrivals = memo(function AvatarPadArrivals({
  arrivals,
}: {
  arrivals: readonly PadArrival[];
}) {
  if (arrivals.length === 0) return null;
  return (
    <>
      {arrivals.map((a) => (
        <AvatarPadArrival key={a.key} arrival={a} />
      ))}
    </>
  );
});

function AvatarPadArrival({ arrival }: { arrival: PadArrival }) {
  const colour = /^#[0-9a-f]{6}$/i.test(arrival.color) ? arrival.color : AVATAR_PALETTE.shirt;
  const lit = tint(colour, 0.55);
  const white = AVATAR_PALETTE.shirtWhite;
  const origin = `50% ${FOOT}px`;
  return (
    <div
      aria-hidden
      data-avatar-pad-arrival=""
      className="avatar-pad-arrival pointer-events-none absolute"
      style={{
        left: arrival.x - BEAM_W / 2,
        top: arrival.y - FOOT * 2,
        width: BEAM_W,
        height: BEAM_H,
      }}
    >
      <svg
        viewBox={`0 0 ${GRID_W} ${GRID_H}`}
        shapeRendering="crispEdges"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <g
          className="avatar-pad-flash"
          style={{ transformOrigin: origin, transformBox: 'view-box' }}
        >
          {FLASH_RUNS.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.width}
              height={1}
              fill={r.inner ? white : colour}
              opacity={r.inner ? 0.75 : 0.95}
            />
          ))}
        </g>
        <g
          className="avatar-pad-beam"
          style={{ transformOrigin: origin, transformBox: 'view-box' }}
        >
          {BANDS.map(([top, opacity], i) => {
            const height = (BANDS[i + 1]?.[0] ?? FOOT + 1) - top;
            return (
              <g key={top} opacity={opacity}>
                <rect x={MID - 9} y={top} width={18} height={height} fill={colour} opacity={0.3} />
                <rect x={MID - 5} y={top} width={10} height={height} fill={lit} opacity={0.6} />
                <rect x={MID - 1} y={top} width={2} height={height} fill={white} opacity={0.95} />
              </g>
            );
          })}
        </g>
        <g>
          {SPARKS.map((s, i) => (
            <rect
              key={i}
              className="avatar-pad-spark"
              x={s.x}
              y={s.y}
              width={s.size}
              height={s.size}
              fill={i % 2 === 0 ? white : lit}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
