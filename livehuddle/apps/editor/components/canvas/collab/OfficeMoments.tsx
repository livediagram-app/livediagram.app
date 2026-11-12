'use client';

import { type MomentKind, type Side } from '@/lib/piece-moments';
import { waveDelay } from '@/lib/piece-moment-motions';
import { Falling, Sparkle, useFreshMoment, vars } from './moment-kit';
import {
  Ring,
  Drips,
  Breeze,
  Dart,
  PrintedPage,
  Copy,
  ColdPuffs,
  Steam,
  MirrorGleam,
  Air,
  PillarLight,
  Sparrow,
} from './office-moment-drawings';

// The drawn-over parts of the static office, amenity, venue and team pieces' moments (docs/specs/009-elements/
// piece-moments.md "Which pieces have a moment"; the blueprint's "Presentation and UX"): a dart, a printed page, a
// kettle's steam, a sparrow. Drawn in the piece's front grid (OFFICE_ART) over its art, one-shot CSS on transform and
// opacity (app/piece-moments-office.css), mounted only while a moment plays. The parts of the piece's own drawing that
// move (books, doors, spokes) are piece-moment-motions.ts, wrapped by FurnitureView.

const OFFICE_KINDS = [
  'bar',
  'garden-umbrella',
  'foosball-table',
  'dartboard',
  'printer',
  'copier',
  'lockers',
  'umbrella-stand',
  'kitchen-sink',
  'fridge',
  'microwave',
  'kettle',
  'toilet-cubicle',
  'washbasin',
  'hand-dryer',
  'car-park',
  'bike-rack',
  'podium',
  'photo-wall',
  'pillar',
  'column',
] as const satisfies readonly MomentKind[];
export type OfficeMomentKind = (typeof OFFICE_KINDS)[number];
const OFFICE_SET: ReadonlySet<string> = new Set(OFFICE_KINDS);

/** Whether this kind's drawn-over parts are here. */
export function hasOfficeMoment(kind: string): kind is OfficeMomentKind {
  return OFFICE_SET.has(kind);
}

export function OfficeMomentParts({ kind, side }: { kind: OfficeMomentKind; side: Side }) {
  switch (kind) {
    case 'bar':
      // A sparkle over each glass as it hops (piece-moment-motions.ts), in the same wave.
      return (
        <>
          {(
            [
              [50, 37],
              [153.5, 39],
              [188, 37],
            ] as const
          ).map(([x, y]) => (
            <Sparkle key={x} x={x} y={y} size={4.5} delay={waveDelay(x, side, 240) + 0.18} />
          ))}
        </>
      );
    case 'garden-umbrella':
      return <Breeze side={side} />;
    case 'foosball-table': {
      // The goal away from you, where the ball goes.
      const x = side < 0 ? 150 : 13;
      return (
        <>
          <rect
            x={x}
            y={41}
            width={5}
            height={12}
            rx={1}
            fill="#fde047"
            className="lh-moment lh-moment-pulse"
            style={vars({ '--peak': 0.95, '--dur': '0.7s', '--delay': '0.42s' })}
          />
          <Sparkle x={x + 2.5} y={47} size={4} delay={0.45} />
        </>
      );
    }
    case 'dartboard':
      return <Dart side={side} />;
    case 'printer':
      return <PrintedPage />;
    case 'copier':
      return <Copy />;
    case 'lockers':
      // A folded note out of the vent of the locker nearest you.
      return (
        <Falling x={side < 0 ? 23 : 113} y={22} fall={90} drift={-side * 8} delay={0.3} dur={2.1}>
          <rect
            x={-4.5}
            y={-3.2}
            width={9}
            height={6.4}
            rx={0.8}
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth={0.6}
          />
          <path d="M-4.5 -3.2L0 0.4L4.5 -3.2" fill="none" stroke="#d97706" strokeWidth={0.6} />
        </Falling>
      );
    case 'umbrella-stand':
      return (
        <>
          <circle
            cx={31}
            cy={40}
            r={1.2}
            fill="#60a5fa"
            className="lh-moment lh-moment-drip"
            style={vars({ '--fall': '18px', '--dur': '0.8s', '--delay': '0.5s' })}
          />
          <Ring x={32} y={61} rx={3.2} ry={1} stroke="#60a5fa" delay={1.22} />
        </>
      );
    case 'kitchen-sink':
      return <Drips x={64} y={11} fall={7} basin={19} delays={[0.1, 0.55, 1]} />;
    case 'fridge':
      return <ColdPuffs />;
    case 'microwave':
      return (
        <>
          <rect
            x={6}
            y={8}
            width={36}
            height={24}
            rx={2.5}
            fill="#fbbf24"
            className="lh-moment lh-moment-pulse"
            style={vars({ '--peak': 0.5, '--dur': '1.2s' })}
          />
          <Sparkle x={55} y={4} size={4} delay={0.95} />
        </>
      );
    case 'kettle':
      return <Steam />;
    case 'toilet-cubicle':
      return (
        <>
          {[0.15, 0.5].map((delay) => (
            <ellipse
              key={delay}
              cx={48}
              cy={91}
              rx={11}
              ry={3.6}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.3}
              vectorEffect="non-scaling-stroke"
              className="lh-moment lh-moment-swirl"
              style={vars({ '--delay': `${delay}s` })}
            />
          ))}
        </>
      );
    case 'washbasin':
      return (
        <>
          <MirrorGleam />
          <Drips x={42} y={55} fall={5} basin={62} delays={[0.15, 0.65]} />
        </>
      );
    case 'hand-dryer':
      return <Air />;
    case 'car-park': {
      // The headlights of the car nearest you, flashing twice as it unlocks.
      const at = side < 0 ? [25, 63] : [177, 215];
      return (
        <>
          {at.map((x) => (
            <ellipse
              key={x}
              cx={x}
              cy={90}
              rx={8.5}
              ry={5}
              fill="#fde047"
              className="lh-moment lh-moment-flash"
            />
          ))}
        </>
      );
    }
    case 'bike-rack':
      return <Sparkle x={side < 0 ? 52 : 118} y={35} size={3.5} delay={0.15} />;
    case 'podium':
      return (
        <>
          {[0.1, 0.35, 0.6].map((delay) => (
            <Ring key={delay} x={47.5} y={4.5} rx={4.5} ry={4.5} stroke="#94a3b8" delay={delay} />
          ))}
        </>
      );
    case 'photo-wall':
      return (
        <>
          <rect
            x={0}
            y={6}
            width={176}
            height={106}
            rx={6}
            fill="#ffffff"
            className="lh-moment lh-moment-camera"
          />
          <Sparkle x={104} y={3} size={4.5} delay={0.08} />
        </>
      );
    case 'pillar':
      return <PillarLight />;
    case 'column':
      return <Sparrow side={side} />;
  }
}

/** The swimming pool's moment, in the pool's own px: a rubber duck bobbing up on your side and dipping away. */
export function PoolMoment({ id, width, height }: { id: string; width: number; height: number }) {
  const play = useFreshMoment(id);
  if (!play) return null;
  const side = play.side;
  const x = width * (0.5 + side * 0.28);
  const y = height * 0.58;
  return (
    <g key={play.seq} aria-hidden className="lh-moment-parts" data-moment-parts="swimming-pool">
      <Ring x={x} y={y + 2} rx={9} ry={3} stroke="#ffffff" delay={0.25} />
      <Ring x={x} y={y + 2} rx={9} ry={3} stroke="#ffffff" delay={0.85} />
      <g transform={`translate(${x} ${y})`}>
        <g className="lh-moment lh-moment-bob">
          <g transform={`scale(${side} 1)`}>
            <ellipse cx={0} cy={0} rx={5.4} ry={3.4} fill="#facc15" />
            <path d="M-5.4 -0.6L-7.6 -2.8L-4.4 -2.2Z" fill="#facc15" />
            <circle cx={3.2} cy={-3.6} r={2.7} fill="#facc15" />
            <path d="M5.6 -3.7L8 -3.1L5.6 -2.4Z" fill="#f97316" />
            <circle cx={3.9} cy={-4.3} r={0.55} fill="#1c1917" />
            <path d="M-2.6 -0.6Q0 -2.4 2.4 -0.4Q0 1.4 -2.6 -0.6Z" fill="#eab308" />
          </g>
        </g>
      </g>
    </g>
  );
}
