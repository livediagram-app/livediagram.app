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

// The four screens the presenting cards talk through.
const TALK: [number, number, string][] = [
  [14, 50, 'Logo'],
  [86, 52, 'Sign in'],
  [160, 52, 'Home'],
  [234, 52, 'Checkout'],
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
      {/* Photos: Sam. */}
      <Tab x={16} w={58} name="Photos" color={SAM} y={33} />
      <Avatar cx={69} cy={41} r={5.5} color={SAM} initials="S" />
      <Status cx={73.2} cy={45} color={SAM} />
      {/* Screens, the active tab: you, and Jordan arriving. */}
      <rect
        className="fill-sky-50 dark:fill-sky-500/15"
        x="82"
        y="29"
        width="80"
        height="24"
        rx="5"
      />
      <Tab x={84} w={40} name="Screens" color={YOU} y={33} />
      <Avatar cx={133} cy={41} r={5.5} color={YOU} initials="TM" />
      <g className="fa-a-pop" style={at(0.8)}>
        <Avatar cx={147} cy={41} r={5.5} color={JORDAN} initials="JR" />
        <Status cx={151.2} cy={45} color={SAM} />
      </g>
      {/* Data: Alex, stepping away. */}
      <Tab x={168} w={30} name="Logo" color={ALEX} y={33} />
      <Avatar cx={208} cy={41} r={5.5} color={ALEX} initials="A" />
      <Status cx={212.2} cy={45} color={SAM} className="fa-a-out" style={at(0.6)} />
      <Status cx={212.2} cy={45} color={AWAY} className="fa-a-late" style={at(0.6)} />
      {/* Docs: someone who left it open and wandered off. */}
      <Tab x={222} w={34} name="Brand" color={JORDAN} y={33} />
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
      <Box x={30} y={36} w={68} h={28} label="Sign in" />
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
          Finish the sign-in screen
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

/** Spotlight: the canvas dims under a shroud, and a soft circle of light tours the steps. */
export function SpotlightArt() {
  return (
    <Scene>
      <Flow steps={TALK} />
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
          <circle className="fa-a-tour" cx="39" cy="48" r="30" fill="url(#fa-a-spot-light)" />
        </mask>
      </defs>
      <rect
        className="fill-slate-900/40 dark:fill-black/65"
        x="-300"
        y="-20"
        width="900"
        height="136"
        mask="url(#fa-a-spot-mask)"
      />
      <g className="fa-a-tour">
        <Pointer x={48} y={56} color={YOU} />
      </g>
    </Scene>
  );
}

/** The laser pointer: a glowing trail that follows the presenter and fades behind them. */
export function LaserArt() {
  const path = 'M18 54 C 54 66, 96 44, 150 46 S 236 60, 286 50';
  const streak = (dash: string): CSSProperties =>
    ({ '--dash': dash, '--len': '275px' }) as CSSProperties;
  return (
    <Scene>
      <Box x={20} y={16} w={56} h={24} label="Logo" />
      <Connector d="M76 28 C 104 28, 100 72, 122 72" head="M118 69 l4 3 l-4 3" />
      <Box x={124} y={60} w={52} h={24} label="Screens" />
      <Connector d="M176 72 C 200 72, 196 28, 222 28" head="M218 25 l4 3 l-4 3" />
      <Box x={224} y={16} w={56} h={24} label="Photo" />
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
