import { useEffect, useState } from 'react';
import type { LaserPoint } from '@/lib/laser-buffer';

// One trail = the laser path drawn by a single participant. Each point
// carries the time it was sampled so the overlay can fade older
// segments out and drop dead points entirely. `color` is the
// participant's identity colour — every viewer sees the same hue for
// the same person.
type LaserTrail = {
  participantId: string;
  color: string;
  points: LaserPoint[];
};

// Lifetime of a single laser sample in ms — older than this and the
// segment renders at 0 opacity. Matched to the throttle window so a
// participant who stops moving sees their trail fully fade in roughly
// one second.
const LIFETIME_MS = 1000;

// Stroke width is fixed in canvas-coords; the overlay sits inside the
// viewport-transformed group so the line scales with zoom. The /zoom
// divisor in callers cancels that scale back out — keeping the visual
// width constant regardless of zoom level.
type LaserOverlayProps = {
  trails: LaserTrail[];
  // Inverse of the viewport zoom — used to keep stroke + dot diameter
  // visually constant. Passed in rather than read from a context so
  // this component stays a pure renderer.
  zoom: number;
};

export function LaserOverlay({ trails, zoom }: LaserOverlayProps) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (trails.length === 0) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [trails.length]);

  if (trails.length === 0) return null;

  const strokeW = 3 / zoom;
  const headR = 6 / zoom;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      {trails.map((trail) => {
        const fresh = trail.points.filter((p) => now - p.t < LIFETIME_MS);
        if (fresh.length === 0) return null;
        const head = fresh[fresh.length - 1]!;
        const headAge = now - head.t;
        const headOpacity = Math.max(0, 1 - headAge / LIFETIME_MS);
        return (
          <g key={trail.participantId}>
            {/* Segment-per-pair so each line renders at the opacity
                of its older endpoint — the tail naturally fades
                before the head as the trail ages. */}
            {fresh.slice(1).map((p, i) => {
              const prev = fresh[i]!;
              const age = now - prev.t;
              const opacity = Math.max(0, 1 - age / LIFETIME_MS);
              return (
                <line
                  key={`${prev.t}-${p.t}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={p.x}
                  y2={p.y}
                  stroke={trail.color}
                  strokeOpacity={opacity}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Glowing dot at the head — twice the stroke width so
                the laser tip reads as a presenter's pointer rather
                than the start of a brush stroke. */}
            <circle
              cx={head.x}
              cy={head.y}
              r={headR}
              fill={trail.color}
              fillOpacity={headOpacity}
            />
            <circle
              cx={head.x}
              cy={head.y}
              r={headR * 1.8}
              fill={trail.color}
              fillOpacity={headOpacity * 0.25}
            />
          </g>
        );
      })}
    </svg>
  );
}
