import { useEffect, useState } from 'react';
import type { LaserPoint } from '@/lib/laser-buffer';
import {
  DEFAULT_LASER_CONFIG,
  laserColour,
  laserLifetimeMs,
  laserStrokeWidth,
  type LaserConfig,
} from '@/lib/laser-config';

// One trail = the laser path drawn by a single participant. Each point
// carries the time it was sampled so the overlay can fade older
// segments out and drop dead points entirely. `color` is the
// participant's identity colour — the fallback, and what "Your colour"
// resolves to. `config` is that participant's own pen (spec/111): it
// travels with their samples, so a presenter's bold amber comet looks
// the same on every screen.
type LaserTrail = {
  participantId: string;
  color: string;
  points: LaserPoint[];
  config?: LaserConfig;
};

// Stroke width is fixed in canvas-coords; the overlay sits inside the
// viewport-transformed group so the line scales with zoom. The /zoom
// divisor cancels that scale back out — keeping the visual width
// constant regardless of zoom level.
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

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      {trails.map((trail) => (
        <Trail key={trail.participantId} trail={trail} zoom={zoom} now={now} />
      ))}
    </svg>
  );
}

function Trail({ trail, zoom, now }: { trail: LaserTrail; zoom: number; now: number }) {
  // A peer who sends no pen at all gets the ORIGINAL laser: medium beam, their
  // own colour, fading over a second. So an older client, or anyone who never
  // opens the panel, looks exactly as they always did.
  const config = trail.config ?? DEFAULT_LASER_CONFIG;
  const lifetime = laserLifetimeMs(config);
  const stroke = laserColour(config, trail.color);
  const strokeW = laserStrokeWidth(config) / zoom;
  const headR = strokeW * 1.7;

  const fresh = trail.points.filter((p) => now - p.t < lifetime);
  if (fresh.length === 0) return null;
  const head = fresh[fresh.length - 1]!;
  const headOpacity = Math.max(0, 1 - (now - head.t) / lifetime);

  return (
    <g>
      {/* Glow (spec/111) lays a wide, faint copy of the trail UNDER the stroke
          — the cheapest thing that survives a washed-out projector. Drawn
          first so the sharp line sits on top of its own halo. */}
      {config.effect === 'glow' ? (
        <Segments
          points={fresh}
          now={now}
          lifetime={lifetime}
          stroke={stroke}
          width={strokeW * 4}
          opacityScale={0.28}
        />
      ) : null}
      {config.effect === 'spark' ? (
        // Spark: a dot per sample rather than a line — a dotted trail that
        // thins as it fades, which suits pointing at a list of things more
        // than drawing a shape around them.
        fresh.map((p) => {
          const opacity = Math.max(0, 1 - (now - p.t) / lifetime);
          return (
            <circle
              key={p.t}
              cx={p.x}
              cy={p.y}
              r={(strokeW / 2) * (0.6 + opacity * 0.9)}
              fill={stroke}
              fillOpacity={opacity}
            />
          );
        })
      ) : (
        <Segments
          points={fresh}
          now={now}
          lifetime={lifetime}
          stroke={stroke}
          width={strokeW}
          // Comet tapers each segment towards the tail, so the direction of
          // travel reads even in a still frame.
          taper={config.effect === 'comet'}
        />
      )}
      {/* The tip: a bright dot with a soft corona, so the laser reads as a
          presenter's pointer rather than the start of a brush stroke. */}
      <circle cx={head.x} cy={head.y} r={headR} fill={stroke} fillOpacity={headOpacity} />
      <circle
        cx={head.x}
        cy={head.y}
        r={headR * 1.8}
        fill={stroke}
        fillOpacity={headOpacity * 0.25}
      />
    </g>
  );
}

// Segment-per-pair so each line renders at the opacity of its older endpoint —
// the tail naturally fades before the head as the trail ages.
function Segments({
  points,
  now,
  lifetime,
  stroke,
  width,
  taper = false,
  opacityScale = 1,
}: {
  points: LaserPoint[];
  now: number;
  lifetime: number;
  stroke: string;
  width: number;
  taper?: boolean;
  opacityScale?: number;
}) {
  return (
    <>
      {points.slice(1).map((p, i) => {
        const prev = points[i]!;
        const opacity = Math.max(0, 1 - (now - prev.t) / lifetime);
        return (
          <line
            key={`${prev.t}-${p.t}`}
            x1={prev.x}
            y1={prev.y}
            x2={p.x}
            y2={p.y}
            stroke={stroke}
            strokeOpacity={opacity * opacityScale}
            // A tapered segment is as wide as its own freshness: a quarter of
            // the width at the tail, full width at the tip.
            strokeWidth={taper ? width * (0.25 + opacity * 0.75) : width}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}
