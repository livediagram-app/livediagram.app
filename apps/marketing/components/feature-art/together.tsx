// Feature illustrations: working together live (docs/specs/019-marketing/marketing-site.md "Feature
// category pages"), the Collaborate category's cards. Plain SVG on the card's 300 by 96 stage (Scene
// in ./canvas-parts), on the shared 6s timeline (app/feature-art/canvas.css, the canvas and
// collaboration block); every piece settles to its finished frame under reduced motion. The sharing
// and access cards live in ./sharing.

import type { CSSProperties } from 'react';
import {
  ALEX,
  AWAY,
  Avatar,
  Box,
  JORDAN,
  MUTED,
  ON_CANVAS,
  Panel,
  Pointer,
  RULE,
  SAM,
  Scene,
  TEXT,
  Tab,
  YOU,
  at,
  from,
} from './canvas-parts';

// A row of cards: [x, width, label], all 24 high at y.
function CardRow({ cards, y = 36 }: { cards: [number, number, string][]; y?: number }) {
  return (
    <g>
      {cards.map(([x, w, label]) => (
        <Box key={label} x={x} y={y} w={w} h={24} label={label} />
      ))}
    </g>
  );
}

// Where the four cards sit.
const ROW: [number, number, string][] = [
  [14, 50, 'Brief'],
  [86, 52, 'Design'],
  [160, 52, 'Build'],
  [234, 52, 'Launch'],
];

/* ───────────────────────── Working together live ───────────────────────── */

// A status dot on an avatar: online, away, idle.
function Status({
  cx,
  cy,
  color,
  className,
  style,
}: {
  cx: number;
  cy: number;
  color: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <circle
      className={`stroke-white dark:stroke-slate-800 ${className ?? ''}`}
      style={style}
      cx={cx}
      cy={cy}
      r="2.2"
      fill={color}
      strokeWidth="1.2"
    />
  );
}

const IDLE = '#94a3b8';

/** Live presence: who is on each tab, in their colour, with a status ring. */
export function PresenceArt() {
  return (
    <Scene>
      <Panel x={12} y={22} w={276} h={38} />
      {/* Overview: Sam. */}
      <Tab x={16} w={58} name="Overview" color={SAM} y={33} />
      <Avatar cx={69} cy={41} r={5.5} color={SAM} initials="S" />
      <Status cx={73.2} cy={45} color={SAM} />
      {/* Board, the active tab: you, and Jordan arriving. */}
      <rect
        className="fill-brand-50 dark:fill-brand-500/15"
        x="82"
        y="29"
        width="80"
        height="24"
        rx="5"
      />
      <Tab x={84} w={40} name="Board" color={YOU} y={33} />
      <Avatar cx={133} cy={41} r={5.5} color={YOU} initials="TM" />
      <g className="fa-a-pop" style={at(0.8)}>
        <Avatar cx={147} cy={41} r={5.5} color={JORDAN} initials="JR" />
        <Status cx={151.2} cy={45} color={SAM} />
      </g>
      {/* Data: Alex, stepping away. */}
      <Tab x={168} w={30} name="Data" color={ALEX} y={33} />
      <Avatar cx={208} cy={41} r={5.5} color={ALEX} initials="A" />
      <Status cx={212.2} cy={45} color={SAM} className="fa-a-out" style={at(0.6)} />
      <Status cx={212.2} cy={45} color={AWAY} className="fa-a-late" style={at(0.6)} />
      {/* Form: someone who left it open and wandered off. */}
      <Tab x={222} w={34} name="Form" color={JORDAN} y={33} />
      <Avatar cx={268} cy={41} r={5.5} color="#64748b" initials="R" />
      <Status cx={272.2} cy={45} color={IDLE} />
      {/* The legend. */}
      {(
        [
          [106, SAM, 'Online'],
          [146, AWAY, 'Away'],
          [180, IDLE, 'Idle'],
        ] as const
      ).map(([x, c, label]) => (
        <g key={label}>
          <circle cx={x} cy="76" r="2.6" fill={c} />
          <text className={MUTED} x={x + 6} y="78.4" fontSize="6.5" fontWeight="600">
            {label}
          </text>
        </g>
      ))}
    </Scene>
  );
}

/** Edits land live: change a card in your window and it changes in Jordan's a beat later. */
export function RealtimeArt() {
  const pane = (x: number, name: string, color: string, initials: string, lag: number) => (
    <g>
      <Panel x={x} y={12} w={112} h={72} />
      <Avatar cx={x + 11} cy={22} r={4.5} color={color} initials={initials} />
      <text className={TEXT} x={x + 19} y="24.4" fontSize="7" fontWeight="700">
        {name}
      </text>
      <path className={RULE} d={`M${x} 31.5 H ${x + 112}`} strokeWidth="1" />
      <rect className="fill-(--art-paper)" x={x + 1} y="32" width="110" height="51" rx="5" />
      <g className="fa-a-out" style={at(lag)}>
        <Box x={x + 26} y={46} w={60} h={24} label="Draft" />
      </g>
      <g className="fa-a-late" style={at(lag)}>
        <rect
          className="fill-emerald-100 stroke-emerald-500 dark:fill-emerald-500/20 dark:stroke-emerald-300"
          x={x + 26}
          y="46"
          width="60"
          height="24"
          rx="5"
          strokeWidth="1.75"
        />
        <text
          className="fill-emerald-800 dark:fill-emerald-100"
          x={x + 56}
          y="60.6"
          fontSize="7.5"
          fontWeight="600"
          textAnchor="middle"
        >
          Shipped
        </text>
      </g>
    </g>
  );
  return (
    <Scene>
      {pane(16, 'You', YOU, 'TM', 0)}
      {pane(172, 'Jordan', JORDAN, 'JR', 0.35)}
      {/* The change, crossing the wire. */}
      <path
        className="stroke-slate-300 dark:stroke-slate-600"
        d="M128 58 H 172"
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />
      <circle
        className="fa-a-move fill-brand-500"
        style={from(-40, 0, 2.5)}
        cx="168"
        cy="58"
        r="2.4"
      />
      <text className={MUTED} x="150" y="52" fontSize="6.5" fontWeight="600" textAnchor="middle">
        live
      </text>
      <Pointer x={76} y={62} color={YOU} />
    </Scene>
  );
}

/** See what others are working on: each person's selection glows in their colour, with their initials. */
export function SelectionGlowArt() {
  const glow = (x: number, w: number, color: string, initials: string) => (
    <g>
      <rect
        x={x - 4.5}
        y="31.5"
        width={w + 9}
        height="33"
        rx="9"
        fill="none"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <rect
        x={x - 2.5}
        y="33.5"
        width={w + 5}
        height="29"
        rx="7"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <rect x={x + w - 12} y="25" width="16" height="10" rx="3" fill={color} />
      <text x={x + w - 4} y="32.2" fontSize="6.5" fontWeight="700" textAnchor="middle" fill="#fff">
        {initials}
      </text>
    </g>
  );
  return (
    <Scene>
      <CardRow cards={ROW.map(([x, w], i) => [x, w, ['Brief', 'Design', 'Build', 'Launch'][i]!])} />
      {glow(14, 50, YOU, 'TM')}
      {glow(234, 52, ALEX, 'A')}
      <g className="fa-a-pop" style={at(1.7)}>
        {glow(86, 52, JORDAN, 'JR')}
      </g>
      <Pointer
        x={124}
        y={56}
        color={JORDAN}
        name="Jordan"
        className="fa-a-move"
        style={from(56, 20, 0)}
      />
    </Scene>
  );
}

/** Comments where the work is: a badge on the card, and its thread open beside it. */
export function CommentsArt() {
  return (
    <Scene>
      <Box x={34} y={38} w={64} h={28} label="Pricing" />
      <path
        className="stroke-pink-300 dark:stroke-pink-400/60"
        d="M104 36 C 116 28, 126 24, 138 22"
        fill="none"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <g className="fa-a-pop" style={at(0.2)}>
        <circle className={ON_CANVAS} cx="98" cy="38" r="6" fill={JORDAN} strokeWidth="1.5" />
        <text x="98" y="40.4" fontSize="6.5" fontWeight="700" textAnchor="middle" fill="#fff">
          2
        </text>
      </g>
      <g className="fa-a-in" style={at(0.5)}>
        <Panel x={138} y={8} w={150} h={80} />
        <Avatar cx={149} cy={20} r={5} color={JORDAN} initials="JR" />
        <text className={TEXT} x="158" y="22.4" fontSize="7" fontWeight="700">
          Jordan
        </text>
        <text className={MUTED} x="186" y="22.4" fontSize="6.5">
          2m
        </text>
        <text className={TEXT} x="149" y="35" fontSize="7">
          Can we lead with the annual plan?
        </text>
      </g>
      <g className="fa-a-pop" style={at(1.4)}>
        <path className={RULE} d="M144 42.5 H 282" strokeWidth="1" />
        <Avatar cx={149} cy={52} r={5} color={YOU} initials="TM" />
        <text className={TEXT} x="158" y="54.4" fontSize="7" fontWeight="700">
          You
        </text>
        <text className={MUTED} x="176" y="54.4" fontSize="6.5">
          now
        </text>
        <text className={TEXT} x="149" y="66" fontSize="7">
          Good call, updating it now.
        </text>
      </g>
      <g className="fa-a-in" style={at(0.5)}>
        <rect
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          x="144"
          y="72"
          width="138"
          height="11"
          rx="5.5"
          strokeWidth="1"
        />
        <text className={MUTED} x="151" y="79.6" fontSize="6.5">
          Reply
        </text>
        <rect className="fa-a-blink fill-brand-500" x="170" y="74.5" width="0.9" height="6" />
      </g>
    </Scene>
  );
}
