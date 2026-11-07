'use client';

// Your hearing ring (docs/specs/012-collaboration/proximity-audio.md "Your hearing ring"): while you talk, unmuted, a
// soft ring in your colour on the floor round your feet at the hearing radius, cut to your room's walls, so you see where people can hear you. It pulses while you talk and fades when you stop. Drawn inside
// the canvas's transformed layer, under the characters, so it pans and zooms with them. Only you see it.
import { useEffect, useId, useMemo, useState } from 'react';
import { useCallSelf } from '@/lib/calls/calls-store';
import { hearingRing } from '@/lib/calls/hearing-ring';
import type { Point } from '@/lib/calls/hearing';
import type { CallZone } from '@/lib/calls/zones';
import type { CallStage } from '@/lib/calls/stage';
import type { AccessLevel } from '@livehuddle/api-schema';

/** The ring's faint fill, edge and ripple strengths. The fill grows a little with your level (1 to 4). */
const FILL_OPACITY_BASE = 0.04;
const FILL_OPACITY_PER_LEVEL = 0.015;
const EDGE_OPACITY = 0.55;
const EDGE_WIDTH_PX = 2;

const pointsOf = (outline: readonly Point[]) => outline.map((p) => `${p.x},${p.y}`).join(' ');
/** The fade after you stop: the ring stays mounted this long at opacity 0, then goes. */
export const HEARING_RING_FADE_MS = 200;

export function HearingRing(props: {
  self: { at: Point; color: string } | null;
  zones: readonly CallZone[];
  // The tab's stages and your share level: speaking from a stage, the whole tab hears you and no ring shows.
  stages: readonly CallStage[];
  level: AccessLevel;
}) {
  const call = useCallSelf();
  const maskId = useId();
  const self = props.self;
  // Whenever your own bars show (in a call, or the microphone's local preview): your level, unmuted. A stage speaker
  // is heard by the whole tab, so there is no ring to show.
  const talking = !!self && !call.muted && call.level > 0 && call.stage !== 'speaker';
  // Kept a moment after you stop, so the ring fades out rather than vanishing.
  const [fading, setFading] = useState(false);
  const [wasTalking, setWasTalking] = useState(talking);
  if (wasTalking !== talking) {
    setWasTalking(talking);
    setFading(!talking);
  }
  useEffect(() => {
    if (!fading) return;
    const timer = setTimeout(() => setFading(false), HEARING_RING_FADE_MS);
    return () => clearTimeout(timer);
  }, [fading]);
  const shown = talking || (fading && !!self);
  // Your room is looked up only while the ring shows: never on a silent step.
  const x = self?.at.x ?? 0;
  const y = self?.at.y ?? 0;
  const seatedOn = self?.at.seatedOn ?? null;
  const ring = useMemo(
    () => (shown ? hearingRing({ x, y, seatedOn }, props.zones, props.stages, props.level) : null),
    [shown, x, y, seatedOn, props.zones, props.stages, props.level],
  );
  if (!ring || !self) return null;

  const pad = EDGE_WIDTH_PX * 2;
  const size = ring.r * 2 + pad * 2;
  const color = self.color;
  const x0 = ring.cx - ring.r - pad;
  const y0 = ring.cy - ring.r - pad;
  const mask = ring.clip || ring.holes.length > 0 ? `url(#${maskId})` : undefined;
  return (
    <svg
      data-hearing-ring
      aria-hidden
      className="animate-hearing-in pointer-events-none absolute overflow-visible transition-opacity duration-200 ease-out"
      width={size}
      height={size}
      viewBox={`${x0} ${y0} ${size} ${size}`}
      style={{
        left: x0,
        top: y0,
        opacity: talking ? 1 : 0,
      }}
    >
      {mask ? (
        <defs>
          {/* Heard where white: your room's floor (or the whole ring in the open), less every other room's. */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x={x0} y={y0} width={size} height={size}>
            {ring.clip ? (
              <polygon points={pointsOf(ring.clip)} fill="white" />
            ) : (
              <rect x={x0} y={y0} width={size} height={size} fill="white" />
            )}
            {ring.holes.map((hole, i) => (
              <polygon key={i} points={pointsOf(hole)} fill="black" />
            ))}
          </mask>
        </defs>
      ) : null}
      <g mask={mask}>
        <circle
          cx={ring.cx}
          cy={ring.cy}
          r={ring.r}
          fill={color}
          fillOpacity={FILL_OPACITY_BASE + FILL_OPACITY_PER_LEVEL * call.level}
        />
        {/* The pulse: a ripple running out from your feet to the edge, only while you talk. */}
        {talking ? (
          <circle
            className="animate-hearing-ripple [transform-box:fill-box] origin-center"
            cx={ring.cx}
            cy={ring.cy}
            r={ring.r}
            fill="none"
            stroke={color}
            strokeWidth={EDGE_WIDTH_PX * 3}
            strokeOpacity={0.35}
          />
        ) : null}
        <circle
          className={talking ? 'animate-hearing-edge' : undefined}
          cx={ring.cx}
          cy={ring.cy}
          r={ring.r}
          fill="none"
          stroke={color}
          strokeWidth={EDGE_WIDTH_PX}
          strokeOpacity={EDGE_OPACITY}
          strokeDasharray="10 8"
        />
      </g>
    </svg>
  );
}
