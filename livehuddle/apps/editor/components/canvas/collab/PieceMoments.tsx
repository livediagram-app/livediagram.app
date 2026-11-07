'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CAMPFIRE_FLAMES,
  FIREPLACE_FLAMES,
  FOUNTAIN_WATER,
  GARDEN_TONES,
  RECREATION_TONES,
  SOCIAL_TONES,
} from '@livehuddle/document';
import {
  swaysOnMoment,
  usePieceMoment,
  type MomentKind,
  type PieceMomentPlay,
  type Side,
} from '@/lib/piece-moments';

// Piece moments (docs/specs/009-elements/piece-moments.md), drawn in the piece's own grid over its art: leaves falling
// from a tree, butterflies out of a bush, a stoked fire's sparks, a coin in the fountain, a can dropping, a pebble in
// the pond. Each is one-shot CSS on transform and opacity (app/piece-moments.css), mounted only once a moment plays
// and keyed by it, so nothing runs at rest; the finished frames are invisible or the resting pose, so nothing needs a
// timer to take them down. None plays under reduced motion (usePieceMoments), and the CSS hides any that was mounted.

const vars = (v: Record<string, string | number>) => v as CSSProperties;

// The moment that played since this view mounted, or null: a tab switched back to never replays an old one.
function useFreshMoment(id: string): PieceMomentPlay | null {
  const play = usePieceMoment(id);
  const [mountedAt] = useState(() => play?.seq ?? 0);
  return play && play.seq > mountedAt ? play : null;
}

/** Rocks a tree's or a plant's whole drawing away from your side when its moment plays. */
export function MomentSway({
  kind,
  id,
  children,
}: {
  kind: string;
  id: string;
  children: ReactNode;
}) {
  const play = useFreshMoment(id);
  if (!swaysOnMoment(kind) || !play) return <g>{children}</g>;
  return (
    <g
      key={play.seq}
      className={`lh-moment ${kind === 'tree' ? 'lh-moment-sway' : 'lh-moment-rustle'}`}
      style={vars({ '--lean': -play.side })}
      data-moment={kind}
    >
      {children}
    </g>
  );
}

/** The moment's own parts over a piece's art, for a moment kind drawn in FurnitureView's grid. */
// The pond draws its own at its own size (PondMoment).
type GridMomentKind = Exclude<MomentKind, 'pond'>;

export function PieceMoment({ kind, id }: { kind: GridMomentKind; id: string }) {
  const play = useFreshMoment(id);
  if (!play) return null;
  return (
    <g key={play.seq} aria-hidden className="lh-moment-parts" data-moment-parts={kind}>
      <MomentParts kind={kind} side={play.side} />
    </g>
  );
}

function MomentParts({ kind, side }: { kind: GridMomentKind; side: Side }) {
  switch (kind) {
    case 'tree':
      return <Leaves side={side} />;
    case 'outdoor-plant':
      return <Butterflies side={side} />;
    case 'plant':
      return (
        <Leaf
          x={10}
          y={46}
          fall={34}
          drift={-6}
          delay={0.15}
          fill={GARDEN_TONES.leafDeep}
          dur={1.8}
        />
      );
    case 'fireplace':
      return <Stoke cx={FIREPLACE_FLAMES.cx} base={FIREPLACE_FLAMES.base} rise={34} glowY={104} />;
    case 'campfire':
      return <Stoke cx={CAMPFIRE_FLAMES.cx} base={CAMPFIRE_FLAMES.base} rise={48} glowY={58} />;
    case 'fountain':
      return <Coin side={side} />;
    case 'vending-machine':
      return <CanDrop />;
  }
}

// One leaf: falls `fall` px, drifting `drift` px, fluttering as it goes, then lies a moment and fades.
function Leaf({
  x,
  y,
  fall,
  drift,
  delay,
  fill,
  dur = 2.2,
}: {
  x: number;
  y: number;
  fall: number;
  drift: number;
  delay: number;
  fill: string;
  dur?: number;
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
        <g className="lh-moment lh-moment-flutter">
          <path d="M0 -3.2C2.6 -2 2.6 2 0 3.2C-2.6 2 -2.6 -2 0 -3.2Z" fill={fill} />
        </g>
      </g>
    </g>
  );
}

// Five leaves from the canopy, one turned yellow, drifting the way the tree leans.
function Leaves({ side }: { side: Side }) {
  const lean = -side;
  const T = GARDEN_TONES;
  return (
    <>
      <Leaf x={32} y={74} fall={74} drift={lean * 10} delay={0.1} fill={T.leafDeep} />
      <Leaf x={54} y={92} fall={56} drift={lean * 14} delay={0.25} fill={T.leaf} />
      <Leaf x={78} y={80} fall={70} drift={lean * 8} delay={0.05} fill={T.leafDark} />
      <Leaf x={94} y={66} fall={84} drift={lean * 12} delay={0.4} fill={T.yellow} />
      <Leaf x={64} y={58} fall={90} drift={lean * 16} delay={0.55} fill={T.leaf} />
    </>
  );
}

// A butterfly: two wings either side of a body, flapping as it flies off `dx` px.
function Butterfly({
  x,
  y,
  dx,
  delay,
  wing,
  size = 1,
}: {
  x: number;
  y: number;
  dx: number;
  delay: number;
  wing: string;
  size?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <g
        className="lh-moment lh-moment-flyaway"
        style={vars({ '--dx': `${dx}px`, '--delay': `${delay}s` })}
      >
        <g className="lh-moment lh-moment-flap">
          <path
            d="M0 0C-3 -7 -9 -6 -8 -1C-7 2 -3 2 0 0ZM0 0C3 -7 9 -6 8 -1C7 2 3 2 0 0ZM0 0C-2 2 -5 5 -3 6C-1 6 0 3 0 0ZM0 0C2 2 5 5 3 6C1 6 0 3 0 0Z"
            fill={wing}
          />
          <rect x={-0.6} y={-3} width={1.2} height={7} rx={0.6} fill={SOCIAL_TONES.soot} />
        </g>
      </g>
    </g>
  );
}

function Butterflies({ side }: { side: Side }) {
  const away = -side;
  return (
    <>
      <Butterfly x={38} y={30} dx={away * 36} delay={0.15} wing={GARDEN_TONES.pink} />
      <Butterfly x={28} y={36} dx={away * 24} delay={0.45} wing={GARDEN_TONES.yellow} size={0.75} />
    </>
  );
}

// A stoked fire: the flames flare and settle, sparks rise out of it, the glow on the ground brightens.
function Stoke({
  cx,
  base,
  rise,
  glowY,
}: {
  cx: number;
  base: number;
  rise: number;
  glowY: number;
}) {
  const tall = 42;
  const w = tall * 0.5;
  const flare =
    `M${cx - w} ${base}C${cx - w} ${base - tall * 0.5} ${cx - w * 0.3} ${base - tall * 0.62} ${cx} ${base - tall}` +
    `C${cx + w * 0.3} ${base - tall * 0.62} ${cx + w} ${base - tall * 0.5} ${cx + w} ${base}Z`;
  const T = SOCIAL_TONES;
  const sparks = [
    { dx: -10, r: 1.6, delay: 0.1, fill: T.flameHot },
    { dx: 6, r: 1.3, delay: 0.2, fill: T.flame },
    { dx: -4, r: 1.1, delay: 0.32, fill: T.flameHot },
    { dx: 12, r: 1.5, delay: 0.42, fill: T.flameHot },
    { dx: -14, r: 1.1, delay: 0.55, fill: T.flame },
    { dx: 2, r: 1.4, delay: 0.66, fill: T.flameHot },
  ];
  return (
    <>
      <ellipse
        cx={cx}
        cy={glowY}
        rx={44}
        ry={10}
        fill={T.flame}
        className="lh-moment lh-moment-glow"
      />
      <path d={flare} fill={T.flame} className="lh-moment lh-moment-flare" />
      {sparks.map((s, i) => (
        <circle
          key={i}
          cx={cx + (i % 2 ? 4 : -4)}
          cy={base - 10}
          r={s.r}
          fill={s.fill}
          className="lh-moment lh-moment-spark"
          style={vars({
            '--dx': `${s.dx}px`,
            '--rise': `${-rise + (i % 3) * 4}px`,
            '--delay': `${s.delay}s`,
          })}
        />
      ))}
    </>
  );
}

// A thrown thing's flight: across `dx` px while it rises `peak` px and comes down `drop` px below where it started.
function Throw({
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

// Where a thrown thing lands: a ring spreading on the water, and a few droplets for a pebble, a glint for a coin.
function Splash({
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

// A coin flipped from your side of the fountain, into the basin, with a glint and a ring.
function Coin({ side }: { side: Side }) {
  const { cx, cy } = FOUNTAIN_WATER;
  const land = { x: cx + side * 22, y: cy + 4 };
  const start = { x: land.x + side * 34, y: 128 };
  return (
    <>
      <Throw x={start.x} y={start.y} dx={land.x - start.x} peak={44} drop={land.y - start.y}>
        <g className="lh-moment lh-moment-spin">
          <ellipse
            rx={3.4}
            ry={3.4}
            fill={GARDEN_TONES.yellow}
            stroke="#b45309"
            strokeWidth={0.8}
          />
        </g>
      </Throw>
      <Splash x={land.x} y={land.y} rx={10} ry={3.5} droplets={false} glint />
    </>
  );
}

// A can tipping off a shelf behind the glass, dropping to the pickup flap; the display blinks.
function CanDrop() {
  const clip = useId();
  const T = RECREATION_TONES;
  return (
    <>
      <clipPath id={clip}>
        <rect x={8} y={23} width={41} height={74} />
        <rect x={10} y={102} width={38} height={13} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g className="lh-moment lh-moment-can">
          <rect x={24} y={54} width={9} height={10} rx={1.5} fill={T.cans[0]} />
          <rect x={24} y={57} width={9} height={2.5} fill="#ffffff" opacity={0.85} />
        </g>
      </g>
      <rect
        x={54}
        y={27}
        width={8}
        height={5}
        rx={1}
        fill="#ecfdf5"
        className="lh-moment lh-moment-blink"
      />
    </>
  );
}

/** The pond's moment, in the pond's own px: a pebble from your side, a plop, rings spreading. */
export function PondMoment({ id, width, height }: { id: string; width: number; height: number }) {
  const play = useFreshMoment(id);
  if (!play) return null;
  const side = play.side;
  const land = { x: width * (0.5 + side * 0.14), y: height * 0.55 };
  const start = { x: land.x + side * Math.min(60, width * 0.3), y: land.y + 10 };
  const ring = Math.max(6, Math.min(18, Math.min(width, height) * 0.12));
  return (
    <g key={play.seq} aria-hidden className="lh-moment-parts" data-moment-parts="pond">
      <Throw x={start.x} y={start.y} dx={land.x - start.x} peak={36} drop={land.y - start.y}>
        <ellipse
          rx={2.8}
          ry={2.2}
          fill={SOCIAL_TONES.stoneDeep}
          stroke="#57534e"
          strokeWidth={0.6}
        />
      </Throw>
      <Splash x={land.x} y={land.y} rx={ring} ry={ring * 0.38} droplets glint={false} />
    </g>
  );
}
