'use client';

import { useId, type ReactNode } from 'react';
import {
  CAMPFIRE_FLAMES,
  FIREPLACE_FLAMES,
  FOUNTAIN_WATER,
  GARDEN_TONES,
  RECREATION_TONES,
  SOCIAL_TONES,
} from '@livehuddle/document';
import type { MomentKind, PieceMomentPlay, Side } from '@/lib/piece-moments';
import { wholeMotionOf } from '@/lib/piece-moment-motions';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { Falling, Splash, Throw, useFreshMoment, vars } from './moment-kit';
import { hasOfficeMoment, OfficeMomentParts } from './OfficeMoments';

// Piece moments (docs/specs/009-elements/piece-moments.md), drawn in the piece's own grid over its art: leaves falling
// from a tree, butterflies out of a bush, a stoked fire's sparks, a coin in the fountain, a can dropping, a pebble in
// the pond (the office, amenity, venue and team pieces' parts are OfficeMoments). Each is one-shot CSS on transform
// and opacity (app/piece-moments.css), mounted only once a moment plays and keyed by it, so nothing runs at rest; the
// finished frames are invisible or the resting pose, so nothing needs a timer to take them down. None plays under
// reduced motion (usePieceMoments), and the CSS hides any that was mounted.

/** A stoked fire's flare and glow on dark paper: a light, warm amber. */
export const DARK_FLARE = '#fcd34d';

/**
 * The piece's drawing, moved by its moment: the whole drawing's motion (a tree's sway, a turned piece's nudge) on a
 * group keyed by the moment, so a new one replays, with `--lean` (away from your side) for the parts inside to swing
 * by. `children` gets the fresh moment, to wrap the parts it moves (FurnitureView, piece-moment-motions.ts).
 */
export function MomentDrawing({
  kind,
  id,
  front,
  children,
}: {
  kind: MomentKind;
  id: string;
  front: boolean;
  children: (play: PieceMomentPlay | null) => ReactNode;
}) {
  const play = useFreshMoment(id);
  if (!play) return <g>{children(null)}</g>;
  const whole = wholeMotionOf(kind, front);
  return (
    <g
      key={play.seq}
      className={whole ? `lh-moment lh-moment-${whole}` : undefined}
      style={vars({ '--lean': -play.side })}
      data-moment={whole ? kind : undefined}
    >
      {children(play)}
    </g>
  );
}

/** The moment's own parts over a piece's art, for a moment kind drawn in FurnitureView's grid. */
// The pond and the swimming pool draw their own at their own size (PondMoment, PoolMoment).
export type GridMomentKind = Exclude<MomentKind, 'pond' | 'swimming-pool'>;

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
  if (hasOfficeMoment(kind)) return <OfficeMomentParts kind={kind} side={side} />;
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
    default:
      return null;
  }
}

// One leaf, falling.
function Leaf({
  fill,
  ...fall
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
    <Falling {...fall}>
      <path d="M0 -6C4.2 -3.6 4.2 3.6 0 6C-4.2 3.6 -4.2 -3.6 0 -6Z" fill={fill} />
    </Falling>
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
  size = 1.3,
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
      <Butterfly x={28} y={36} dx={away * 24} delay={0.45} wing={GARDEN_TONES.yellow} size={1} />
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
  // On dark paper the orange flare read brown and muddy over the soot: a brighter amber there instead.
  const flareFill = useCanvasSurface() === 'dark' ? DARK_FLARE : T.flame;
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
        fill={flareFill}
        className="lh-moment lh-moment-glow"
      />
      <path d={flare} fill={flareFill} className="lh-moment lh-moment-flare" />
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
