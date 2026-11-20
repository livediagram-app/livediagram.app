// Feature illustrations: working together and presenting to the room
// (docs/specs/019-marketing/marketing-site.md "Feature category pages"), the Collaborate
// category's cards. Plain SVG on the card's 300 by 96 stage (Scene in ./canvas-parts), on the
// shared 6s timeline (app/feature-art/canvas.css, the canvas and collaboration block); every piece settles to its
// finished frame under reduced motion. Split from ./canvas.tsx, which keeps the editing and tab
// scenes; the sharing and access cards live in ./sharing.

import type { CSSProperties } from 'react';
import {
  ALEX,
  AWAY,
  Avatar,
  Box,
  CHECK_PATHS,
  CLOCK_PATHS,
  Connector,
  Glyph,
  JORDAN,
  MUTED,
  ON_CANVAS,
  Panel,
  Pill,
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

// A row of steps joined left to right: [x, width, label], all 24 high at y.
function Flow({ steps, y = 36 }: { steps: [number, number, string][]; y?: number }) {
  return (
    <g>
      {steps.map(([x, w, label], i) => {
        const next = steps[i + 1];
        return (
          <g key={label}>
            <Box x={x} y={y} w={w} h={24} label={label} />
            {next ? (
              <Connector
                d={`M${x + w} ${y + 12} H ${next[0] - 2}`}
                head={`M${next[0] - 6} ${y + 9} l4 3 l-4 3`}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

// The four-step flow the presenting cards talk through.
const TALK: [number, number, string][] = [
  [14, 50, 'Collect'],
  [86, 52, 'Score'],
  [160, 52, 'Decide'],
  [234, 52, 'Ship'],
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
      {/* Backend, the active tab: you, and Jordan arriving. */}
      <rect
        className="fill-sky-50 dark:fill-sky-500/15"
        x="82"
        y="29"
        width="80"
        height="24"
        rx="5"
      />
      <Tab x={84} w={40} name="Backend" color={YOU} y={33} />
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
      {/* Docs: someone who left it open and wandered off. */}
      <Tab x={222} w={34} name="Docs" color={JORDAN} y={33} />
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

/** Edits land live: change a step in your window and it changes in Jordan's a beat later. */
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
        className="fa-a-move fill-sky-500"
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
      <Flow steps={TALK.map(([x, w], i) => [x, w, ['Login', 'Verify', 'Welcome', 'Home'][i]!])} />
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

/** Comments on any element: a badge on the shape, and its thread open beside it. */
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
        <rect className="fa-a-blink fill-sky-500" x="170" y="74.5" width="0.9" height="6" />
      </g>
    </Scene>
  );
}

/** Assign actions: a shape becomes a piece of work, handed to Alex, then ticked off. */
export function AssignedActionsArt() {
  return (
    <Scene>
      <Box x={30} y={36} w={68} h={28} label="API spec" />
      <circle className={ON_CANVAS} cx="98" cy="36" r="5.5" fill={YOU} strokeWidth="1.5" />
      <Glyph x={94.5} y={32.5} className="stroke-white" scale={0.7}>
        {CHECK_PATHS}
      </Glyph>
      <path
        className="stroke-sky-300 dark:stroke-sky-500/60"
        d="M104 46 H 128"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <g className="fa-a-in" style={at(0.3)}>
        <Panel x={128} y={10} w={150} h={76} />
        <text
          className="fill-sky-600 dark:fill-sky-300"
          x="137"
          y="22"
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="0.4"
        >
          ACTION
        </text>
        <text className={TEXT} x="137" y="35" fontSize="8.5" fontWeight="700">
          Write the API spec
        </text>
        <Avatar cx={143} cy={50} r={5.5} color={ALEX} initials="A" />
        <text className={TEXT} x="152" y="52.4" fontSize="7" fontWeight="600">
          Alex
        </text>
        <Glyph x={210} y={45.5} className="stroke-slate-400 dark:stroke-slate-500" scale={0.9}>
          {CLOCK_PATHS}
        </Glyph>
        <Pill x={222} y={44.5} w={46} label="Due Friday" tone="amber" />
        <path className={RULE} d="M128 61.5 H 278" strokeWidth="1" />
      </g>
      <g className="fa-a-out" style={at(1)}>
        <rect
          className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500"
          x="137"
          y="68"
          width="9"
          height="9"
          rx="2"
          strokeWidth="1.2"
        />
        <text className={MUTED} x="151" y="75" fontSize="7" fontWeight="600">
          Mark done
        </text>
      </g>
      <g className="fa-a-late" style={at(1)}>
        <rect x="137" y="68" width="9" height="9" rx="2" fill={SAM} />
        <Glyph x={136.5} y={67.5} className="stroke-white">
          {CHECK_PATHS}
        </Glyph>
        <Pill x={151} y={67} w={28} label="Done" tone="green" />
      </g>
    </Scene>
  );
}

/* ───────────────────────── Presenting to the room ───────────────────────── */

/** A slide page filling the stage, as it is presented: white paper edge to edge, its title top left. */
function SlideSheet({ title }: { title: string }) {
  return (
    <g>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x="8"
        y="5"
        width="284"
        height="86"
        rx="2"
        strokeWidth="0.8"
      />
      <text className={TEXT} x="18" y="19" fontSize="7.4" fontWeight="800">
        {title}
      </text>
    </g>
  );
}

// The busy slide's four figures, one under each stop of the light's tour (fa-a-tour: 0, 73, 147 and 221 across).
const FIGURES: [string, string, string][] = [
  ['12.4k', 'New sign-ups', 'fill-sky-600 dark:fill-sky-300'],
  ['3.1%', 'Monthly churn', 'fill-rose-600 dark:fill-rose-300'],
  ['48', 'NPS', 'fill-emerald-600 dark:fill-emerald-300'],
  ['£1.2M', 'Revenue', 'fill-violet-600 dark:fill-violet-300'],
];

/** Spotlight: the slide dims under a shroud, and a soft circle of light tours its figures one at a time. */
export function SpotlightArt() {
  return (
    <Scene>
      <SlideSheet title="Q3 at a glance" />
      {FIGURES.map(([value, label, tone], i) => {
        const cx = 39 + i * 73.4;
        return (
          <g key={label}>
            <rect
              className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
              x={cx - 29}
              y="31"
              width="58"
              height="36"
              rx="3"
              strokeWidth="0.7"
            />
            <text className={tone} x={cx} y="51" fontSize="11" fontWeight="800" textAnchor="middle">
              {value}
            </text>
            <text className={MUTED} x={cx} y="60.5" fontSize="5" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
      <defs>
        <radialGradient id="fa-a-spot-light">
          <stop offset="0.62" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask
          id="fa-a-spot-mask"
          maskUnits="userSpaceOnUse"
          x="-300"
          y="-20"
          width="900"
          height="136"
        >
          <rect x="-300" y="-20" width="900" height="136" fill="#fff" />
          <circle className="fa-a-tour" cx="39" cy="49" r="32" fill="url(#fa-a-spot-light)" />
        </mask>
      </defs>
      <rect
        className="fill-slate-900/45 dark:fill-black/65"
        x="-300"
        y="-20"
        width="900"
        height="136"
        mask="url(#fa-a-spot-mask)"
      />
      <g className="fa-a-tour">
        <Pointer x={50} y={60} color={YOU} />
      </g>
    </Scene>
  );
}

// The chart's months and their sign-ups, in thousands: September is the jump the presenter points at.
const MONTHS: [string, number][] = [
  ['Apr', 6.1],
  ['May', 6.8],
  ['Jun', 7.4],
  ['Jul', 7.9],
  ['Aug', 8.6],
  ['Sep', 12.4],
];

/** The laser pointer: a glowing trail over a presented slide, swept up to the month that jumped, fading behind. */
export function LaserArt() {
  const path = 'M44 80 C 96 84, 150 74, 196 58 S 246 22, 268 20';
  const streak = (dash: string): CSSProperties =>
    ({ '--dash': dash, '--len': '275px' }) as CSSProperties;
  return (
    <Scene>
      <SlideSheet title="Sign-ups by month" />
      <text className={MUTED} x="18" y="28" fontSize="5">
        Thousands, Q2 and Q3
      </text>
      <path className={RULE} d="M108 77.5 H 280" strokeWidth="0.8" />
      {MONTHS.map(([month, k], i) => {
        const h = k * 4;
        const x = 116 + i * 27;
        const last = i === MONTHS.length - 1;
        return (
          <g key={month}>
            <rect
              className={last ? 'fill-sky-500' : 'fill-sky-200 dark:fill-sky-500/40'}
              x={x}
              y={77 - h}
              width="15"
              height={h}
              rx="1.5"
            />
            <text className={MUTED} x={x + 7.5} y="85.5" fontSize="4.6" textAnchor="middle">
              {month}
            </text>
          </g>
        );
      })}
      <text className={TEXT} x="18" y="50" fontSize="13" fontWeight="800">
        +44%
      </text>
      <text className={MUTED} x="18" y="59" fontSize="5">
        September on August
      </text>
      <path
        className="fa-a-streak stroke-rose-500/45 blur-[1.5px]"
        style={streak('90px')}
        d={path}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="fa-a-streak stroke-rose-500"
        style={streak('90px')}
        d={path}
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        className="fa-a-streak stroke-rose-100"
        style={streak('5px')}
        d={path}
        fill="none"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </Scene>
  );
}
