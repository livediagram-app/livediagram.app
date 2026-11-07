'use client';

// The shared parts of the piece moments (docs/specs/009-elements/piece-moments.md): the fresh-moment hook every moment
// view reads, and the one-shot pieces more than one moment draws (something falling, a thrown thing's flight, a
// splash, a sparkle). Their keyframes are app/piece-moments.css.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { usePieceMoment, type PieceMomentPlay } from '@/lib/piece-moments';

/** Custom properties for a moment part's style. */
export const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** The moment that played since this view mounted, or null: a tab switched back to never replays an old one. */
export function useFreshMoment(id: string): PieceMomentPlay | null {
  const play = usePieceMoment(id);
  const [mountedAt] = useState(() => play?.seq ?? 0);
  return play && play.seq > mountedAt ? play : null;
}

/** Something falling `fall` px, drifting `drift` px, fluttering as it goes, then lying a moment and fading. */
export function Falling({
  x,
  y,
  fall,
  drift,
  delay,
  dur = 2.2,
  children,
}: {
  x: number;
  y: number;
  fall: number;
  drift: number;
  delay: number;
  dur?: number;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        className="lh-moment lh-moment-fall"
        style={vars({
          '--fall': `${fall}px`,
          '--drift': `${drift}px`,
          '--delay': `${delay}s`,
          '--dur': `${dur}s`,
        })}
      >
        <g className="lh-moment lh-moment-flutter">{children}</g>
      </g>
    </g>
  );
}

/** A thrown thing's flight: across `dx` px while it rises `peak` px and comes down `drop` px below where it started. */
export function Throw({
  x,
  y,
  dx,
  peak,
  drop,
  children,
}: {
  x: number;
  y: number;
  dx: number;
  peak: number;
  drop: number;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="lh-moment lh-moment-across" style={vars({ '--dx': `${dx}px` })}>
        <g
          className="lh-moment lh-moment-arc"
          style={vars({ '--peak': `${-peak}px`, '--drop': `${drop}px` })}
        >
          {children}
        </g>
      </g>
    </g>
  );
}

/** Where a thrown thing lands: a ring spreading on the water, and a few droplets for a pebble, a glint for a coin. */
export function Splash({
  x,
  y,
  rx,
  ry,
  droplets,
  glint,
}: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  droplets: boolean;
  glint: boolean;
}) {
  return (
    <>
      <ellipse
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="lh-moment lh-moment-ripple"
        style={vars({ '--delay': '0.6s' })}
      />
      <ellipse
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
        className="lh-moment lh-moment-ripple"
        style={vars({ '--delay': '0.95s' })}
      />
      {droplets
        ? [-5, 0, 5].map((dx) => (
            <circle
              key={dx}
              cx={x}
              cy={y}
              r={1.4}
              fill="#ffffff"
              className="lh-moment lh-moment-droplet"
              style={vars({ '--dx': `${dx}px`, '--up': `${dx === 0 ? -12 : -8}px` })}
            />
          ))
        : null}
      {glint ? (
        <path
          d={`M${x} ${y - 6}L${x + 1.4} ${y - 1.4}L${x + 6} ${y}L${x + 1.4} ${y + 1.4}L${x} ${y + 6}L${x - 1.4} ${y + 1.4}L${x - 6} ${y}L${x - 1.4} ${y - 1.4}Z`}
          fill="#ffffff"
          className="lh-moment lh-moment-glint"
        />
      ) : null}
    </>
  );
}

/** A four-point sparkle at (x, y) that pops and spins away: light caught on glass or metal. */
export function Sparkle({
  x,
  y,
  size = 5,
  delay,
}: {
  x: number;
  y: number;
  size?: number;
  delay: number;
}) {
  const r = size * 0.23;
  return (
    <path
      d={`M${x} ${y - size}L${x + r} ${y - r}L${x + size} ${y}L${x + r} ${y + r}L${x} ${y + size}L${x - r} ${y + r}L${x - size} ${y}L${x - r} ${y - r}Z`}
      fill="#ffffff"
      stroke="#facc15"
      strokeWidth={0.6}
      className="lh-moment lh-moment-sparkle"
      style={vars({ '--delay': `${delay}s` })}
    />
  );
}
