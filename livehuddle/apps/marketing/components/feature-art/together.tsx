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
  JORDAN,
  MUTED,
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

/* ───────────────────────── Presenting to the room ───────────────────────── */
