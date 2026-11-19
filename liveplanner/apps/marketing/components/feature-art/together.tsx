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
import { AK, JR, PlanCard, SM, TM } from './plan-parts';

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

/** Edits land live: you move a card to Done and it moves in Jordan's window a beat later. */
export function RealtimeArt() {
  const pane = (
    x: number,
    name: string,
    color: string,
    initials: string,
    lag: number,
    you: boolean,
  ) => (
    <g>
      <Panel x={x} y={8} w={128} h={80} />
      <Avatar cx={x + 11} cy={18} r={4.5} color={color} initials={initials} />
      <text className={TEXT} x={x + 19} y="20.4" fontSize="6.6" fontWeight="700">
        {name}
      </text>
      <path className={RULE} d={`M${x} 27.5 H ${x + 128}`} strokeWidth="1" />
      {['In Progress', 'Done'].map((col, i) => (
        <g key={col}>
          <rect
            className="fill-slate-100 dark:fill-slate-900/70"
            x={x + 5 + i * 60}
            y={31}
            width={58}
            height={53}
            rx="3"
          />
          <text className={TEXT} x={x + 9 + i * 60} y={39} fontSize="5" fontWeight="700">
            {col}
          </text>
        </g>
      ))}
      <PlanCard x={x + 8} y={43} w={52} title="Beta invites" id="TSK-16" who={SM} />
      <PlanCard x={x + 68} y={43} w={52} title="Logo refresh" id="TSK-3" type="idea" who={AK} />
      {/* The card that moves, from In Progress into Done. */}
      <g className="fa-a-move" style={from(-60, 0, lag)}>
        <PlanCard x={x + 68} y={64} w={52} title="Pricing page" id="TSK-14" who={TM} />
        {you ? <Pointer x={x + 97} y={78} color={YOU} /> : null}
      </g>
    </g>
  );
  return (
    <Scene>
      {pane(10, 'You', YOU, 'TM', 0, true)}
      {pane(162, 'Jordan', JORDAN, 'JR', 0.5, false)}
      {/* The change, crossing the wire. */}
      <path
        className="stroke-slate-300 dark:stroke-slate-600"
        d="M139 48 H 161"
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />
      <circle
        className="fa-a-move fill-brand-500"
        style={from(-20, 0, 0.3)}
        cx="159"
        cy="48"
        r="2.2"
      />
    </Scene>
  );
}

/** A teammate's colour round what they are in: a card's ring with their first name on a Board, and outlined cells
 *  with a name tag on a Sheet (help: collaboration/live-presence "On a Board", "On a Sheet"). */
export function SelectionGlowArt() {
  const tag = (x: number, y: number, name: string, color: string) => (
    <g>
      <rect x={x} y={y} width={name.length * 3.2 + 6} height="8" rx="2" fill={color} />
      <text x={x + 3} y={y + 5.7} fontSize="5" fontWeight="700" fill="#fff">
        {name}
      </text>
    </g>
  );
  const cells = [
    ['Venue', '1,200'],
    ['Catering', '860'],
    ['Travel', '540'],
  ];
  return (
    <Scene>
      {/* A Board: Jordan has Checkout flow open, so it wears their ring and name. */}
      <Panel x={10} y={8} w={140} h={80} />
      {['To Do', 'In Progress'].map((col, i) => (
        <g key={col}>
          <rect
            className="fill-slate-100 dark:fill-slate-900/70"
            x={15 + i * 67}
            y={13}
            width={63}
            height={70}
            rx="3"
          />
          <text className={TEXT} x={19 + i * 67} y={21} fontSize="5" fontWeight="700">
            {col}
          </text>
        </g>
      ))}
      <PlanCard x={18} y={26} w={57} title="Press kit" id="TSK-31" who={SM} />
      <PlanCard x={18} y={49} w={57} title="Release notes" id="TSK-23" type="note" />
      <PlanCard x={85} y={49} w={57} title="Login bug" id="BUG-21" type="bug" who={AK} />
      <PlanCard x={85} y={26} w={57} title="Checkout flow" id="TSK-27" who={JR} />
      <g className="fa-a-pop" style={at(0.6)}>
        <rect
          x={83}
          y={24}
          width={61}
          height={23}
          rx="3.5"
          fill="none"
          stroke={JORDAN}
          strokeWidth="1.3"
        />
        {tag(121, 18.5, 'Jordan', JORDAN)}
      </g>
      {/* A Sheet: Alex's selected cells outlined in their colour, their name on a tag. */}
      <Panel x={158} y={8} w={132} h={80} />
      <rect
        className="fill-slate-50 dark:fill-slate-900/60"
        x={158.5}
        y={8.5}
        width={131}
        height={12}
        rx="5.5"
      />
      {['A', 'B', 'C'].map((c, i) => (
        <text
          key={c}
          className={MUTED}
          x={196 + i * 40}
          y={16.6}
          fontSize="5"
          fontWeight="600"
          textAnchor="middle"
        >
          {c}
        </text>
      ))}
      <g className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="0.6">
        {[20.5, 37.5, 54.5, 71.5].map((y) => (
          <path key={y} d={`M158 ${y} H290`} />
        ))}
        <path d="M170 8 V88 M216 8 V88 M256 8 V88" />
      </g>
      {['1', '2', '3', '4'].map((r, i) => (
        <text key={r} className={MUTED} x={164} y={31.6 + i * 17} fontSize="5" textAnchor="middle">
          {r}
        </text>
      ))}
      <text className={TEXT} x={174} y={31.6} fontSize="5.4" fontWeight="700">
        Item
      </text>
      <text className={TEXT} x={252} y={31.6} fontSize="5.4" fontWeight="700" textAnchor="end">
        Cost
      </text>
      {cells.map(([item, cost], i) => (
        <g key={item}>
          <text className={TEXT} x={174} y={48.6 + i * 17} fontSize="5.4">
            {item}
          </text>
          <text className={TEXT} x={252} y={48.6 + i * 17} fontSize="5.4" textAnchor="end">
            {cost}
          </text>
        </g>
      ))}
      <g className="fa-a-pop" style={at(1.4)}>
        <rect
          x={216}
          y={37.5}
          width={40}
          height={34}
          fill={ALEX}
          fillOpacity="0.08"
          stroke={ALEX}
          strokeWidth="1.3"
        />
        {tag(216, 72.5, 'Alex', ALEX)}
      </g>
    </Scene>
  );
}

/** Comments where the work is: the comments pill on the card, and its thread open beside it. */
export function CommentsArt() {
  return (
    <Scene>
      <rect
        className="fill-slate-100 dark:fill-slate-900/70"
        x={12}
        y={10}
        width={108}
        height={76}
        rx="4"
      />
      <text className={TEXT} x={17} y={18} fontSize="5.4" fontWeight="700">
        Review
      </text>
      <PlanCard x={16} y={22} w={100} title="Pricing page" id="TSK-14" who={AK} ring={JORDAN} />
      {/* The card's comments pill: a speech bubble and the count, in the card's quiet meta ink. */}
      <g className="fa-a-pop" style={at(0.2)}>
        <rect
          x={50}
          y={32.4}
          width="15"
          height="6.4"
          rx="1.6"
          className="fill-slate-100 dark:fill-slate-700"
        />
        <path
          d="M52.6 33.9h5a0.8 0.8 0 0 1 0.8 0.8v1.8a0.8 0.8 0 0 1 -0.8 0.8h-3.2l-1.6 1v-1h-0.2a0.8 0.8 0 0 1 -0.8 -0.8v-1.8a0.8 0.8 0 0 1 0.8 -0.8z"
          fill="none"
          className="stroke-slate-500 dark:stroke-slate-300"
          strokeWidth="0.55"
        />
        <text
          x={60.8}
          y={37.4}
          fontSize="4.2"
          fontWeight="700"
          className="fill-slate-600 dark:fill-slate-300"
        >
          2
        </text>
      </g>
      <PlanCard x={16} y={43} w={100} title="Hero copy" id="TSK-21" who={TM} />
      <PlanCard x={16} y={64} w={100} title="Onboarding emails" id="TSK-11" who={SM} />
      <path
        className="stroke-pink-300 dark:stroke-pink-400/60"
        d="M117 31 C 124 28, 130 25, 138 22"
        fill="none"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
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
