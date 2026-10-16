// Feature illustrations for event storming boards (docs/specs/021-event-storming/event-storming.md): the
// board with its notation on timeline lanes, and a photo of a real sticky wall read onto it. Note
// fills are the catalogue's own (packages/document/src/event-storming.ts), which keep their colour
// under every theme, so they are identity colours rather than Default-theme ink.

import { HAIRLINE, PANEL, SHADOW, Scene, TEXT_MUTED } from './canvas-marks';
import { Frame } from './shared';

// The catalogue's paper for each note kind the cards show.
const NOTE = {
  event: '#fdba74',
  command: '#93c5fd',
  actor: '#fef08a',
  policy: '#d8b4fe',
  readModel: '#86efac',
  hotspot: '#fca5a5',
} as const;

// The dark marker ink notes are written in.
const MARKER = '#292524';

type Note = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  lines: string[];
  tilt: number;
  className?: string;
  delay?: string;
};

// One paper note: its fill, a soft drop shadow, a slight hand-placed tilt, and its words in marker
// capitals, centred.
function StormNote({ x, y, w, h, fill, lines, tilt, className, delay }: Note) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const size = w < 26 ? 4.2 : 4.8;
  const top = cy - ((lines.length - 1) * (size + 1.2)) / 2 + size / 3;
  return (
    <g className={className} style={delay ? { animationDelay: delay } : undefined}>
      <g transform={`rotate(${tilt} ${cx} ${cy})`}>
        <g className="[filter:drop-shadow(0_1.5px_1.5px_rgb(15_23_42/0.2))]">
          <rect x={x} y={y} width={w} height={h} rx="0.8" fill={fill} />
        </g>
        <text
          x={cx}
          y={top}
          fontSize={size}
          fontWeight="700"
          fill={MARKER}
          textAnchor="middle"
          letterSpacing="0.2"
        >
          {lines.map((line, i) => (
            <tspan key={line} x={cx} dy={i === 0 ? 0 : size + 1.2}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}

// The board: three timeline lanes, the story told left to right in the notation's colours (who,
// what they asked, what happened, the rule that reacts), a hotspot on the risky step, and the
// newest event landing in the slot Alt opened for it.
export function EventStormingArt() {
  const lanes = [20, 48, 76];
  return (
    <Frame canvas>
      <Scene>
        {lanes.map((y) => (
          <line
            key={y}
            className={HAIRLINE}
            x1="8"
            x2="292"
            y1={y}
            y2={y}
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />
        ))}
        <StormNote x={14} y={10} w={22} h={18} fill={NOTE.actor} lines={['BUYER']} tilt={-3} />
        <StormNote
          x={40}
          y={34}
          w={30}
          h={28}
          fill={NOTE.command}
          lines={['PLACE', 'ORDER']}
          tilt={2}
        />
        <StormNote
          x={76}
          y={34}
          w={30}
          h={28}
          fill={NOTE.event}
          lines={['ORDER', 'PLACED']}
          tilt={-2}
        />
        <StormNote
          x={112}
          y={64}
          w={44}
          h={26}
          fill={NOTE.policy}
          lines={['WHEN PLACED,', 'TAKE PAYMENT']}
          tilt={1.5}
        />
        {/* The step that was missing, landing in the slot that opened for it. */}
        <StormNote
          className="fa-d-land"
          x={162}
          y={34}
          w={30}
          h={28}
          fill={NOTE.event}
          lines={['STOCK', 'RESERVED']}
          tilt={2.5}
        />
        <rect
          className="fa-d-ring stroke-brand-500 dark:stroke-brand-400"
          x="159"
          y="31"
          width="36"
          height="34"
          rx="2"
          fill="none"
          strokeWidth="1"
          strokeDasharray="2.5 2"
        />
        <StormNote
          x={200}
          y={34}
          w={30}
          h={28}
          fill={NOTE.event}
          lines={['PAYMENT', 'TAKEN']}
          tilt={-1.5}
        />
        <StormNote
          x={206}
          y={5}
          w={36}
          h={22}
          fill={NOTE.hotspot}
          lines={['CARD', 'DECLINED?']}
          tilt={4}
        />
        <StormNote
          x={238}
          y={34}
          w={30}
          h={28}
          fill={NOTE.event}
          lines={['ORDER', 'SHIPPED']}
          tilt={1}
        />
        <StormNote
          x={244}
          y={66}
          w={40}
          h={22}
          fill={NOTE.readModel}
          lines={['DELIVERY', 'TRACKER']}
          tilt={-2}
        />
      </Scene>
    </Frame>
  );
}

// Photo import: the wall as photographed (a box found on each sticky, one unticked because it is
// not a note), the Add button counting what will come in, and the notes landing on the board in
// their kinds' colours, where they sat on the wall.
export function StickyPhotoArt() {
  const found = [
    { x: 18, y: 18, fill: NOTE.event, keep: true },
    { x: 44, y: 14, fill: NOTE.event, keep: true },
    { x: 70, y: 20, fill: NOTE.command, keep: true },
    { x: 26, y: 46, fill: NOTE.actor, keep: true },
    { x: 58, y: 48, fill: NOTE.hotspot, keep: true },
  ];
  return (
    <Frame canvas>
      <Scene>
        {/* The photo of the wall. */}
        <g className={SHADOW}>
          <rect x="10" y="8" width="98" height="64" rx="3" fill="#a8a29e" />
        </g>
        <rect x="10" y="8" width="98" height="64" rx="3" fill="#d6d3d1" fillOpacity="0.55" />
        {found.map((n, i) => (
          <g key={`${n.x}-${n.y}`}>
            <rect
              x={n.x}
              y={n.y}
              width="18"
              height="17"
              fill={n.fill}
              transform={`rotate(${i % 2 ? 4 : -3} ${n.x + 9} ${n.y + 8.5})`}
            />
            <path
              d={`M${n.x + 4} ${n.y + 7} h8 M${n.x + 4} ${n.y + 10.5} h6`}
              stroke={MARKER}
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.55"
            />
            <rect
              className="stroke-brand-500 dark:stroke-brand-400"
              x={n.x - 2}
              y={n.y - 2}
              width="22"
              height="21"
              rx="1.5"
              fill="none"
              strokeWidth="0.9"
            />
            <circle
              className="fill-brand-500 dark:fill-brand-400"
              cx={n.x + 19}
              cy={n.y - 1}
              r="2.6"
            />
            <path
              d={`M${n.x + 17.8} ${n.y - 1} l0.9 0.9 l1.6 -1.8`}
              stroke="#fff"
              strokeWidth="0.8"
              fill="none"
            />
          </g>
        ))}
        {/* A coffee cup it found too, unticked: not a note. */}
        <circle cx="94" cy="56" r="7" fill="#78716c" />
        <circle cx="94" cy="56" r="4.4" fill="#44403c" />
        <rect
          x="85"
          y="47"
          width="18"
          height="18"
          rx="1.5"
          fill="none"
          className="stroke-slate-400"
          strokeWidth="0.8"
          strokeDasharray="2 1.5"
        />
        <circle cx="103" cy="47" r="2.6" className={PANEL} strokeWidth="0.7" />
        {/* The button that brings them in. */}
        <g className={SHADOW}>
          <rect x="30" y="78" width="58" height="12" rx="6" className="fill-brand-700" />
        </g>
        <text x="59" y="86" fontSize="5.6" fontWeight="700" fill="#fff" textAnchor="middle">
          Add 5 notes
        </text>
        <path className="stroke-(--art-arrow)" d="M118 42 H140" strokeWidth="1.1" fill="none" />
        <path className="fill-(--art-arrow)" d="M144 42 l-5 -3 v6z" />
        {/* The board, the notes landing where they were on the wall. */}
        <text className={TEXT_MUTED} x="156" y="14" fontSize="5" fontWeight="600">
          Draft: check, then keep
        </text>
        {found.map((n, i) => (
          <StormNote
            key={`board-${n.x}-${n.y}`}
            className="fa-d-land"
            delay={`${0.35 * i}s`}
            x={150 + (n.x - 10) * 1.3}
            y={20 + (n.y - 10) * 1.05}
            w={26}
            h={22}
            fill={n.fill}
            lines={[['ORDER', 'PAID', 'PAY', 'BUYER', 'FRAUD?'][i]!]}
            tilt={i % 2 ? 3 : -2}
          />
        ))}
      </Scene>
    </Frame>
  );
}
