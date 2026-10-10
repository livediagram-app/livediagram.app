// Feature illustrations: working together, presenting to the room, and sharing
// (docs/specs/019-marketing/marketing-site.md "Feature category pages"), the Collaborate
// category's cards. Plain SVG on the card's 300 by 96 stage (Scene in ./canvas-parts), on the
// shared 6s timeline (app/feature-art-animations.css, the canvas and collaboration block); every piece settles to its
// finished frame under reduced motion. Split from ./canvas.tsx, which keeps the editing and tab
// scenes.

import type { CSSProperties } from 'react';
import {
  ALEX,
  AWAY,
  Avatar,
  Box,
  CHECK_PATHS,
  CLOCK_PATHS,
  Connector,
  FOLDER_PATHS,
  Glyph,
  JORDAN,
  LINK_PATHS,
  LOCK_PATHS,
  MUTED,
  ON_CANVAS,
  PEOPLE_PATHS,
  Panel,
  Pill,
  PixelWalker,
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
      <Box x={20} y={16} w={56} h={24} label="Client" />
      <Connector d="M76 28 C 104 28, 100 72, 122 72" head="M118 69 l4 3 l-4 3" />
      <Box x={124} y={60} w={52} h={24} label="API" />
      <Connector d="M176 72 C 200 72, 196 28, 222 28" head="M218 25 l4 3 l-4 3" />
      <Box x={224} y={16} w={56} h={24} label="Store" />
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

/** Avatar mode: your character walks to the step you are talking about, and the room celebrates. */
export function AvatarModeArt() {
  const confetti: [number, number, string][] = [
    [-16, -6, '#f43f5e'],
    [-8, -14, '#f59e0b'],
    [2, -17, '#10b981'],
    [11, -12, '#8b5cf6'],
    [18, -4, '#0ea5e9'],
    [-22, 2, '#ec4899'],
    [24, 4, '#f59e0b'],
  ];
  return (
    <Scene>
      <Flow
        y={14}
        steps={[
          [26, 56, 'Plan'],
          [122, 56, 'Build'],
          [218, 56, 'Launch'],
        ]}
      />
      <rect
        className="fa-a-late fill-none stroke-sky-500"
        style={at(0)}
        x="213"
        y="9"
        width="66"
        height="34"
        rx="9"
        strokeWidth="2"
        strokeOpacity="0.7"
      />
      <g className="fa-a-late" style={at(0)}>
        {confetti.map(([dx, dy, c], i) => (
          <rect
            key={i}
            x={246 + dx}
            y={8 + dy}
            width="3"
            height="3"
            rx="0.6"
            fill={c}
            transform={`rotate(${i * 37} ${247.5 + dx} ${9.5 + dy})`}
          />
        ))}
      </g>
      {/* Jordan, waving their flag by the plan. */}
      <PixelWalker x={54} y={86} shirt={JORDAN} flag />
      {/* You, walking over to the launch. */}
      <g className="fa-a-move" style={from(-96, 0, 0)}>
        <PixelWalker x={246} y={86} shirt={YOU} />
      </g>
    </Scene>
  );
}

/* ───────────────────────── Sharing and access ───────────────────────── */

/** Editor, participant or view-only links: three passes side by side, one copied to send. */
export function ShareLinksArt() {
  // One row per pass: its role, its link and what it lets the holder do, on a single line.
  const row = (
    y: number,
    label: string,
    url: string,
    role: string,
    tone: 'sky' | 'amber' | 'slate',
  ) => (
    <g>
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="50"
        y={y}
        width="200"
        height="18"
        rx="5"
        strokeWidth="1"
      />
      <text className={TEXT} x="58" y={y + 11.6} fontSize="7" fontWeight="700">
        {label}
      </text>
      <text
        className={MUTED}
        x="110"
        y={y + 11.4}
        fontSize="6"
        fontFamily="ui-monospace, monospace"
      >
        {url}
      </text>
      <Pill x={204} y={y + 3.5} w={40} label={role} tone={tone} />
    </g>
  );
  return (
    <Scene>
      <Panel x={40} y={6} w={220} h={84} />
      <Glyph x={50} y={13} className="stroke-sky-600 dark:stroke-sky-300">
        {LINK_PATHS}
      </Glyph>
      <text className={TEXT} x="63" y="20.5" fontSize="8" fontWeight="700">
        Share
      </text>
      <g className="fa-a-out" style={at(0.9)}>
        <Pill x={214} y={12} w={36} label="Copy" tone="solid" />
      </g>
      <g className="fa-a-late" style={at(0.9)}>
        <Pill x={210} y={12} w={40} label="Copied" tone="green" />
      </g>
      {row(28, 'Editors', 'livediagram.app/d/9fk2', 'Can edit', 'sky')}
      {row(48, 'Participants', 'livediagram.app/d/m3wd', 'Can add', 'amber')}
      {row(68, 'Viewers', 'livediagram.app/d/qp7x', 'Can view', 'slate')}
      <Pointer x={232} y={19} color={YOU} className="fa-a-move" style={from(24, 46, 0)} />
    </Scene>
  );
}

/** Teams: a shared space with its people and roles, a new member joining, and its shared folder. */
export function TeamsArt() {
  const member = (
    y: number,
    color: string,
    initials: string,
    name: string,
    role: string,
    tone: 'sky' | 'slate' | 'amber',
  ) => (
    <g>
      <Avatar cx={32} cy={y} r={5.5} color={color} initials={initials} />
      <text className={TEXT} x="41" y={y + 2.4} fontSize="7" fontWeight="600">
        {name}
      </text>
      <Pill x={126} y={y - 5.5} w={38} label={role} tone={tone} />
    </g>
  );
  return (
    <Scene>
      <Panel x={20} y={6} w={154} h={84} />
      <Glyph x={28} y={13} className="stroke-sky-600 dark:stroke-sky-300">
        {PEOPLE_PATHS}
      </Glyph>
      <text className={TEXT} x="41" y="20.5" fontSize="8" fontWeight="700">
        Design team
      </text>
      <text className={MUTED} x="164" y="20.5" fontSize="6.5" fontWeight="600" textAnchor="end">
        3 people
      </text>
      <path className={RULE} d="M20 28.5 H 174" strokeWidth="1" />
      {member(40, YOU, 'TM', 'You', 'Admin', 'sky')}
      {member(57, JORDAN, 'JR', 'Jordan', 'Member', 'slate')}
      <g className="fa-a-pop" style={at(0.9)}>
        {member(74, ALEX, 'A', 'Alex', 'Invited', 'amber')}
      </g>
      {/* The team's shared folder, everyone's to open. */}
      <Panel x={186} y={18} w={100} h={60} />
      <Glyph
        x={196}
        y={26}
        className="fill-sky-100 stroke-sky-600 dark:fill-sky-500/20 dark:stroke-sky-300"
        scale={2.2}
      >
        {FOLDER_PATHS}
      </Glyph>
      <text className={TEXT} x="226" y="40" fontSize="7.5" fontWeight="700">
        Design
      </text>
      <text className={MUTED} x="226" y="49" fontSize="6.5">
        12 documents
      </text>
      <Avatar cx={198} cy={64} r={4.5} color={YOU} initials="TM" />
      <Avatar cx={206} cy={64} r={4.5} color={JORDAN} initials="JR" />
      <g className="fa-a-pop" style={at(0.9)}>
        <Avatar cx={214} cy={64} r={4.5} color={ALEX} initials="A" />
      </g>
    </Scene>
  );
}

/** Links that expire on their own: one counting down its days, one lapsed and extended. */
export function ExpiryArt() {
  return (
    <Scene>
      <Panel x={40} y={6} w={220} h={84} />
      <Glyph x={50} y={13} className="stroke-sky-600 dark:stroke-sky-300">
        {CLOCK_PATHS}
      </Glyph>
      <text className={TEXT} x="63" y="20.5" fontSize="8" fontWeight="700">
        Link expiry
      </text>
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="50"
        y="30"
        width="200"
        height="24"
        rx="5"
        strokeWidth="1"
      />
      <text className={TEXT} x="58" y="44.6" fontSize="7" fontFamily="ui-monospace, monospace">
        /d/9fk2
      </text>
      {/* The days left, draining round a ring. */}
      <circle
        className="stroke-sky-100 dark:stroke-sky-500/25"
        cx="196"
        cy="42"
        r="5"
        fill="none"
        strokeWidth="2"
      />
      <circle
        className="fa-a-drain stroke-sky-500"
        cx="196"
        cy="42"
        r="5"
        fill="none"
        strokeWidth="2"
        strokeDasharray="31.4"
        transform="rotate(-90 196 42)"
      />
      <text
        className="fill-sky-700 dark:fill-sky-200"
        x="205"
        y="44.4"
        fontSize="6.5"
        fontWeight="700"
      >
        6 days left
      </text>
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="50"
        y="60"
        width="200"
        height="24"
        rx="5"
        strokeWidth="1"
      />
      <g className="fa-a-out" style={at(0.8)}>
        <text
          className={MUTED}
          x="58"
          y="74.6"
          fontSize="7"
          fontFamily="ui-monospace, monospace"
          textDecoration="line-through"
        >
          /d/qp7x
        </text>
        <Pill x={208} y={66.5} w={36} label="Expired" tone="red" />
      </g>
      <g className="fa-a-late" style={at(0.8)}>
        <text className={TEXT} x="58" y="74.6" fontSize="7" fontFamily="ui-monospace, monospace">
          /d/qp7x
        </text>
        <Pill x={202} y={66.5} w={42} label="+30 days" tone="green" />
      </g>
      <Pointer x={226} y={72} color={YOU} className="fa-a-move" style={from(20, 20, 0)} />
    </Scene>
  );
}

/** Stop sharing on demand: switch the link off and the document is yours again. */
export function RevokeArt() {
  return (
    <Scene>
      <Panel x={50} y={10} w={200} h={76} />
      <Glyph x={60} y={17} className="stroke-sky-600 dark:stroke-sky-300">
        {LINK_PATHS}
      </Glyph>
      <text className={TEXT} x="73" y="24.5" fontSize="8" fontWeight="700">
        Share link
      </text>
      {/* The switch: on, then off. */}
      <g className="fa-a-out" style={at(0.6)}>
        <rect className="fill-sky-500" x="220" y="16" width="20" height="11" rx="5.5" />
        <circle cx="234.5" cy="21.5" r="4" fill="#fff" />
      </g>
      <g className="fa-a-late" style={at(0.6)}>
        <rect
          className="fill-slate-300 dark:fill-slate-600"
          x="220"
          y="16"
          width="20"
          height="11"
          rx="5.5"
        />
        <circle cx="225.5" cy="21.5" r="4" fill="#fff" />
      </g>
      <path className={RULE} d="M50 34.5 H 250" strokeWidth="1" />
      <rect
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        x="60"
        y="42"
        width="180"
        height="18"
        rx="4"
        strokeWidth="1"
      />
      <g className="fa-a-out" style={at(0.6)}>
        <text className={TEXT} x="68" y="53.6" fontSize="7" fontFamily="ui-monospace, monospace">
          livediagram.app/d/9fk2
        </text>
        <Pill x={60} y={67} w={38} label="Shared" tone="green" />
      </g>
      <g className="fa-a-late" style={at(0.6)}>
        <text
          className={MUTED}
          x="68"
          y="53.6"
          fontSize="7"
          fontFamily="ui-monospace, monospace"
          textDecoration="line-through"
        >
          livediagram.app/d/9fk2
        </text>
        <rect
          className="fill-slate-100 dark:fill-slate-700"
          x="60"
          y="67"
          width="42"
          height="11"
          rx="5.5"
        />
        <Glyph x={63} y={67.4} className="stroke-slate-600 dark:stroke-slate-300" scale={0.9}>
          {LOCK_PATHS}
        </Glyph>
        <text
          className="fill-slate-600 dark:fill-slate-300"
          x="74"
          y="74.6"
          fontSize="6.5"
          fontWeight="600"
        >
          Private
        </text>
        <text className={MUTED} x="110" y="74.6" fontSize="6.5">
          Only you can open it
        </text>
      </g>
      <Pointer x={232} y={23} color={YOU} className="fa-a-move" style={from(-24, 44, 0)} />
    </Scene>
  );
}
