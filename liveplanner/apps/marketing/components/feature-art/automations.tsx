// Feature illustrations: Automations (docs/specs/026-plan/automations.md), the Automations category's cards. A
// rule read as When, If and Then; the Templates gallery; the triggers a rule can start from; rules on a time;
// and people assigned in turn. Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css),
// which settles to the finished frame under reduced motion.
import type { ReactNode } from 'react';
import {
  ALEX,
  Avatar,
  CLOCK_PATHS,
  Glyph,
  JORDAN,
  MUTED,
  Panel,
  Pill,
  Pointer,
  SAM,
  Scene,
  TEXT,
  YOU,
  at,
  from,
} from './canvas-parts';

// A rule's step kinds, each in its own tint: the trigger amber, a condition sky, an action green.
export const WHEN = '#f59e0b';
export const IF = '#0ea5e9';
export const THEN = '#10b981';

/** A step's mark in its tinted disc: the trigger's bolt, a condition's diamond or an action's tick. */
export function StepMark({
  cx,
  cy,
  kind,
}: {
  cx: number;
  cy: number;
  kind: 'when' | 'if' | 'then';
}) {
  const tint = kind === 'when' ? WHEN : kind === 'if' ? IF : THEN;
  return (
    <g>
      <circle cx={cx} cy={cy} r="6.5" fill={tint} fillOpacity="0.16" />
      {kind === 'when' ? (
        <path d={`M${cx + 0.6} ${cy - 3.6}l-2.8 4.2h2.3l-.5 3 2.8-4.2h-2.3z`} fill={tint} />
      ) : kind === 'if' ? (
        <path
          d={`M${cx} ${cy - 3.2}l3.2 3.2-3.2 3.2-3.2-3.2z`}
          fill="none"
          stroke={tint}
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={`M${cx - 2.4} ${cy}l1.6 1.6 3.2-3.4`}
          fill="none"
          stroke={tint}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/** A step card: its mark, its kind in small capitals and its sentence. */
export function Step({
  x,
  y,
  w,
  kind,
  text,
}: {
  x: number;
  y: number;
  w: number;
  kind: 'when' | 'if' | 'then';
  text: string;
}) {
  return (
    <g>
      <Panel x={x} y={y} w={w} h={30} />
      <StepMark cx={x + 12} cy={y + 15} kind={kind} />
      <text
        className={MUTED}
        x={x + 23}
        y={y + 12}
        fontSize="5"
        fontWeight="700"
        letterSpacing="0.5"
      >
        {kind === 'when' ? 'WHEN' : kind === 'if' ? 'IF ALL OF THESE' : 'THEN'}
      </text>
      <text className={TEXT} x={x + 23} y={y + 22} fontSize="6.6" fontWeight="700">
        {text}
      </text>
    </g>
  );
}

// A done tick on a step's corner as a run reaches it.
function Ticked({ x, y, d }: { x: number; y: number; d: number }) {
  return (
    <g className="fa-a-pop" style={at(d)}>
      <circle cx={x} cy={y} r="4.5" fill={THEN} />
      <path
        d={`M${x - 2} ${y}l1.3 1.3 2.6-2.8`}
        stroke="#fff"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A rule in plain words: When a card moves, If it is a Bug, Then assign the next person, each ticked in turn. */
export function RuleFlowArt() {
  const steps = [
    { x: 14, kind: 'when', text: 'Card Moved' },
    { x: 110, kind: 'if', text: 'Type is Bug' },
    { x: 206, kind: 'then', text: 'Assign in Turn' },
  ] as const;
  return (
    <Scene>
      {steps.map((s, i) => (
        <g key={s.text}>
          <Step x={s.x} y={33} w={80} kind={s.kind} text={s.text} />
          <Ticked x={s.x + 78} y={35} d={0.5 + i * 0.45} />
        </g>
      ))}
      {[94, 190].map((x, i) => (
        <g key={x} className="fa-a-in" style={at(0.3 + i * 0.45)}>
          <path
            d={`M${x + 2} 48h12`}
            className="stroke-slate-300 dark:stroke-slate-600"
            strokeWidth="1.2"
          />
          <path
            d={`M${x + 11} 45.5l3 2.5-3 2.5`}
            fill="none"
            className="stroke-slate-300 dark:stroke-slate-600"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* The person the rule picked, dropping onto the step. */}
      <g className="fa-a-move" style={from(0, -14, 1.5)}>
        <Avatar cx={276} cy={74} r={6} color={JORDAN} initials="JR" />
      </g>
    </Scene>
  );
}

// A template tile's picture: the moment its rule acts on a little board.
function TemplateTile({
  x,
  name,
  category,
  tone,
  tint,
  lifted = false,
  children,
}: {
  x: number;
  name: string;
  category: string;
  tone: 'green' | 'brand' | 'amber';
  tint: string;
  lifted?: boolean;
  children: ReactNode;
}) {
  return (
    <g className={lifted ? 'fa-a-pop' : undefined} style={lifted ? at(0.2) : undefined}>
      <Panel x={x} y={lifted ? 8 : 12} w={84} h={74} />
      <rect
        x={x + 6}
        y={(lifted ? 8 : 12) + 6}
        width="72"
        height="30"
        rx="4"
        fill={tint}
        fillOpacity="0.12"
      />
      <g transform={lifted ? 'translate(0 -4)' : undefined}>{children}</g>
      <text className={TEXT} x={x + 7} y={(lifted ? 8 : 12) + 48} fontSize="6.2" fontWeight="700">
        {name}
      </text>
      <Pill
        x={x + 6}
        y={(lifted ? 8 : 12) + 55}
        w={category.length * 3.7 + 10}
        label={category}
        tone={tone}
      />
    </g>
  );
}

/** The Templates gallery: ready-made rules as tiles, each a small picture of the rule at work. */
export function RuleTemplatesArt() {
  return (
    <Scene>
      <TemplateTile x={14} name="Stamp the Finish Date" category="Status" tone="green" tint={THEN}>
        {/* A card slides into Done and takes its date. */}
        <rect
          x="58"
          y="22"
          width="16"
          height="22"
          rx="2"
          fill="none"
          stroke={THEN}
          strokeOpacity="0.5"
        />
        <g className="fa-a-move" style={from(-30, 0, 0.6)}>
          <rect
            x="60"
            y="26"
            width="12"
            height="8"
            rx="1.5"
            className="fill-white dark:fill-slate-700"
          />
        </g>
        <rect
          className="fa-a-pop"
          style={at(1.4)}
          x="60"
          y="36"
          width="12"
          height="4"
          rx="2"
          fill={THEN}
        />
      </TemplateTile>
      <TemplateTile
        x={108}
        name="Triage New Bugs"
        category="Assigning"
        tone="brand"
        tint={ALEX}
        lifted
      >
        {/* A bug card lands, then its assignee drops on. */}
        <rect
          x="128"
          y="20"
          width="44"
          height="18"
          rx="2.5"
          className="fill-white dark:fill-slate-700"
        />
        <rect x="132" y="25" width="6" height="3" rx="1" fill="#ef4444" />
        <rect
          x="132"
          y="31"
          width="22"
          height="2.5"
          rx="1"
          className="fill-slate-300 dark:fill-slate-500"
        />
        <g className="fa-a-move" style={from(0, -12, 0.9)}>
          <Avatar cx={166} cy={30} r={4.5} color={ALEX} initials="AK" />
        </g>
      </TemplateTile>
      <TemplateTile
        x={202}
        name="Nudge Stuck Cards"
        category="Telling People"
        tone="amber"
        tint={WHEN}
      >
        {/* A card that has sat still is flagged. */}
        <rect
          x="222"
          y="24"
          width="44"
          height="18"
          rx="2.5"
          className="fill-white dark:fill-slate-700"
        />
        <rect
          x="226"
          y="31"
          width="24"
          height="2.5"
          rx="1"
          className="fill-slate-300 dark:fill-slate-500"
        />
        <path
          className="fa-a-pop"
          style={at(1.6)}
          d="M258 28v8M258 28h5l-1.5 2 1.5 2h-5"
          fill="#ef4444"
          stroke="#ef4444"
          strokeWidth="0.8"
        />
      </TemplateTile>
      <Pointer className="fa-a-in" style={at(0.4)} x={160} y={60} color={YOU} />
    </Scene>
  );
}

/** Triggers for every moment: the When step, and the things that can start it lighting in turn. */
export function TriggersArt() {
  const chips = [
    'Card Moved',
    'Form Response',
    'Someone Mentioned',
    'Checklist Completed',
    'Card Unblocked',
    'Column Over Limit',
  ];
  return (
    <Scene>
      <Step x={14} y={33} w={92} kind="when" text="Form Response" />
      {chips.map((label, i) => {
        const x = 128 + (i % 2) * 82;
        const y = 16 + Math.floor(i / 2) * 26;
        return (
          <g key={label}>
            <Pill
              className="fa-a-pop"
              style={at(0.2 + i * 0.12)}
              x={x}
              y={y}
              w={76}
              label={label}
            />
            {label === 'Form Response' ? (
              <rect
                className="fa-a-pop"
                style={at(1.2)}
                x={x - 1.5}
                y={y - 1.5}
                width="79"
                height="14"
                rx="7"
                fill="none"
                stroke={WHEN}
                strokeWidth="1.2"
              />
            ) : null}
          </g>
        );
      })}
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(1.3)}
        d="M208 27.5C190 27.5 128 30 108 44"
        fill="none"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </Scene>
  );
}

/** Rules on a time: every weekday at 9:00, the overdue cards are flagged and their people emailed. */
export function ScheduleArt() {
  const cards = [
    { y: 14, who: SAM, initials: 'SM' },
    { y: 40, who: JORDAN, initials: 'JR' },
    { y: 66, who: ALEX, initials: 'AK' },
  ];
  return (
    <Scene>
      <Panel x={14} y={28} w={104} h={40} />
      <Glyph x={22} y={37} scale={1.2} className="stroke-amber-500">
        {CLOCK_PATHS}
      </Glyph>
      <text className={MUTED} x="38" y="40" fontSize="5" fontWeight="700" letterSpacing="0.5">
        SCHEDULED
      </text>
      <text className={TEXT} x="38" y="50" fontSize="6.8" fontWeight="700">
        Every weekday
      </text>
      <text className={MUTED} x="38" y="59" fontSize="6">
        at 9:00
      </text>
      <path
        className="fa-a-in stroke-(--art-arrow)"
        style={at(0.4)}
        d="M120 48h22"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {cards.map((c, i) => (
        <g key={c.initials}>
          <Panel x={148} y={c.y} w={110} h={18} />
          <rect
            className="fill-slate-300 dark:fill-slate-600"
            x="155"
            y={c.y + 7.5}
            width="40"
            height="3"
            rx="1.5"
          />
          <Pill x={200} y={c.y + 3.5} w={34} label="Overdue" tone="red" />
          <Avatar cx={248} cy={c.y + 9} r={5} color={c.who} initials={c.initials} />
          {/* Flagged, and an email on its way to them. */}
          <path
            className="fa-a-pop"
            style={at(0.8 + i * 0.25)}
            d={`M264 ${c.y + 4}v10M264 ${c.y + 4}h6l-2 2.5 2 2.5h-6`}
            fill="#ef4444"
            stroke="#ef4444"
            strokeWidth="0.8"
          />
          <g className="fa-a-pop" style={at(1.1 + i * 0.25)}>
            <rect
              x="274"
              y={c.y + 4}
              width="12"
              height="9"
              rx="1.5"
              className="fill-white stroke-slate-400 dark:fill-slate-800"
              strokeWidth="0.8"
            />
            <path
              d={`M274.5 ${c.y + 4.8}l5.5 4 5.5-4`}
              fill="none"
              className="stroke-slate-400"
              strokeWidth="0.8"
            />
          </g>
        </g>
      ))}
    </Scene>
  );
}

/** People in turn: each new card goes to the next person on triage, so the work is shared out evenly. */
export function AssignTurnArt() {
  const people = [
    { color: ALEX, initials: 'AK' },
    { color: JORDAN, initials: 'JR' },
    { color: SAM, initials: 'SM' },
  ];
  return (
    <Scene>
      <Step x={14} y={18} w={96} kind="then" text="Assign in Turn" />
      <g>
        {people.map((p, i) => (
          <Avatar
            key={p.initials}
            cx={36 + i * 18}
            cy={68}
            r={6.5}
            color={p.color}
            initials={p.initials}
          />
        ))}
        <text className={MUTED} x="90" y="70" fontSize="5.6">
          Triage
        </text>
      </g>
      {people.map((p, i) => {
        const x = 132 + i * 56;
        return (
          <g key={p.initials}>
            <g className="fa-a-pop" style={at(0.2 + i * 0.5)}>
              <Panel x={x} y={30} w={48} h={36} />
              <rect
                x={x + 6}
                y={36}
                width="10"
                height="4"
                rx="1.5"
                fill="#ef4444"
                fillOpacity="0.8"
              />
              <rect
                className="fill-slate-300 dark:fill-slate-600"
                x={x + 6}
                y={45}
                width="30"
                height="3"
                rx="1.5"
              />
              <rect
                className="fill-slate-200 dark:fill-slate-700"
                x={x + 6}
                y={51}
                width="20"
                height="3"
                rx="1.5"
              />
            </g>
            <g className="fa-a-move" style={from(0, -16, 0.5 + i * 0.5)}>
              <Avatar cx={x + 40} cy={58} r={5.5} color={p.color} initials={p.initials} />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}
