// Behaviour-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/009-elements/mode-button.md to docs/specs/012-collaboration/picker.md and
// docs/specs/009-elements/reaction-pad.md): the palette's Behaviour groups, plus one scene per element that
// does something when somebody presses it: Selection Mode buttons, Session
// buttons, the Done check, Reaction pads, Reveal zones and the Picker.
//
// One scene per sub-article, so each small article can show the surface it
// describes with the real labels the editor prints on it. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks (glyph chips,
// confetti, an eye).

import type { ReactNode } from 'react';

import { Scene, Label, TextBar, Avatar, Button, Panel, Cursor } from './primitives';

// --- Small motifs the primitive kit does not carry -------------------------

/** The eye a Reveal cover draws above its label. */
function Eye({ x, y, off = false }: { x: number; y: number; off?: boolean }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="stroke-slate-500"
      strokeWidth={1.6}
      fill="none"
    >
      <path d="M-9 0s3.6-5 9-5 9 5 9 5-3.6 5-9 5-9-5-9-5z" strokeLinejoin="round" />
      <circle cx={0} cy={0} r={2.4} />
      {off ? <path d="M-7 -7 L7 7" strokeLinecap="round" /> : null}
    </g>
  );
}

/** A round glyph chip, the way a Session or Selection Mode button draws its
 *  tool icon above the words. */
function Chip({
  x,
  y,
  r = 15,
  children,
}: {
  x: number;
  y: number;
  r?: number;
  children: ReactNode;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} className="fill-brand-50 stroke-brand-200" strokeWidth={1.5} />
      <g transform={`translate(${x} ${y})`}>{children}</g>
    </g>
  );
}

const glyph = { className: 'stroke-brand-600', strokeWidth: 1.8, fill: 'none' } as const;

/** A pointer arrow, the Select mode glyph. */
function SelectGlyph() {
  return <path d="M-5 -7 L5 2 L0 2.6 L3 8 L0.6 9 L-2 3.6 L-5.4 6.6 Z" className="fill-brand-600" />;
}
/** A clock, the Timer glyph. */
function ClockGlyph() {
  return (
    <g {...glyph}>
      <circle r={7.5} />
      <path d="M0 -4 V0 L3 2.5" strokeLinecap="round" />
    </g>
  );
}
/** Three dots in a row, the Dot vote glyph. */
function DotsGlyph() {
  return (
    <g className="fill-brand-600">
      <circle cx={-6} cy={0} r={2.4} />
      <circle cx={0} cy={0} r={2.4} />
      <circle cx={6} cy={0} r={2.4} />
    </g>
  );
}
/** Two answer bars, the Poll glyph. */
function PollGlyph() {
  return (
    <g className="fill-brand-600">
      <rect x={-7} y={-6} width={14} height={4} rx={2} />
      <rect x={-7} y={2} width={9} height={4} rx={2} />
    </g>
  );
}
/** A laser dot with a trail. */
function LaserGlyph() {
  return (
    <g>
      <path
        d="M-7 6 Q-1 1 4 -4"
        className="stroke-brand-400"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={5} cy={-5} r={3} className="fill-rose-500" />
    </g>
  );
}
/** A little walking character, the Avatar mode glyph. */
function AvatarGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <circle cy={-4.5} r={3} />
      <path d="M0 -1.5 V4 M-4 7 L0 4 L4 7 M-3.5 1 H3.5" />
    </g>
  );
}

/** A page with ruled lines, the Record group glyph. */
function RecordGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <rect x={-6} y={-8} width={12} height={16} rx={2} />
      <path d="M-3 -3 H3 M-3 1 H3 M-3 5 H1" />
    </g>
  );
}
/** A four-point spark, the React group glyph. */
function SparkGlyph() {
  return <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" className="fill-brand-600" />;
}
/** An hourglass, the Timer glyph (it runs down). */
function HourglassGlyph() {
  return (
    <g {...glyph} strokeLinejoin="round">
      <path d="M-5 -8 H5 M-5 8 H5 M-4 -8 C-4 -3 4 -2 4 0 C4 2 -4 3 -4 8 M4 -8 C4 -3 -4 -2 -4 0 C-4 2 4 3 4 8" />
    </g>
  );
}
/** A stopwatch, the Stopwatch glyph (it counts up). */
function StopwatchGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <circle cy={1.5} r={6.5} />
      <path d="M0 1.5 V-2 M-2 -8 H2 M0 -8 V-5" />
    </g>
  );
}

// --- Scenes ----------------------------------------------------------------

/** The Collaborate category of the palette (id `behaviour`): a search box over the six group
 *  tiles you click into. Ordered room-first, with the labels BEHAVIOUR_GROUPS gives them. */
export function BehaviourGroups() {
  const px = 52;
  const py = 12;
  const groups: { label: string; icon: ReactNode }[] = [
    { label: 'Ask', icon: <PollGlyph /> },
    { label: 'Tools', icon: <ClockGlyph /> },
    { label: 'Record', icon: <RecordGlyph /> },
    { label: 'React', icon: <SparkGlyph /> },
    { label: 'Selection Mode', icon: <SelectGlyph /> },
    { label: 'Navigate', icon: <AvatarGlyph /> },
  ];
  return (
    <Scene w={420} h={228} bg="plain">
      <Panel x={px} y={py} w={316} h={200} title="COLLABORATE">
        {/* Search across all six groups at once */}
        <rect
          x={px + 12}
          y={py + 30}
          width={292}
          height={22}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <circle
          cx={px + 25}
          cy={py + 41}
          r={4}
          className="fill-none stroke-slate-400"
          strokeWidth={1.5}
        />
        <path
          d="M0 0 L4 4"
          transform={`translate(${px + 28} ${py + 44})`}
          className="stroke-slate-400"
          strokeWidth={1.5}
        />
        <Label x={px + 38} y={py + 42} size={10} tone="muted">
          Search collaboration
        </Label>
        {groups.map((g, i) => {
          const gx = px + 12 + (i % 3) * 102;
          const gy = py + 62 + Math.floor(i / 3) * 66;
          return (
            <g key={g.label}>
              <rect
                x={gx}
                y={gy}
                width={88}
                height={56}
                rx={9}
                className="fill-white stroke-slate-200"
                strokeWidth={1.5}
              />
              <Chip x={gx + 44} y={gy + 20} r={13}>
                {g.icon}
              </Chip>
              <Label x={gx + 44} y={gy + 45} anchor="middle" size={10} weight={600} tone="body">
                {g.label}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** A control bar of Selection Mode buttons across the top of a canvas: two
 *  offering a mode, one offering the way back out. */
export function ModeButtonBar() {
  const buttons: { label: string; icon: ReactNode; leaving?: boolean }[] = [
    { label: 'Switch to Select', icon: <SelectGlyph /> },
    { label: 'Switch to Laser', icon: <LaserGlyph /> },
    { label: 'Leave Avatar', icon: <AvatarGlyph />, leaving: true },
  ];
  return (
    <Scene w={420} h={210}>
      {buttons.map((b, i) => {
        const bx = 26 + i * 126;
        return (
          <g key={b.label}>
            <rect
              x={bx}
              y={20}
              width={112}
              height={72}
              rx={10}
              className={
                b.leaving ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-300'
              }
              strokeWidth={2}
            />
            <Chip x={bx + 56} y={45}>
              {b.icon}
            </Chip>
            <Label x={bx + 56} y={78} anchor="middle" size={10} weight={600} tone="body">
              {b.label}
            </Label>
          </g>
        );
      })}
      <Label x={26} y={124} size={10} weight={700} tone="muted">
        THE MODE CHANGES FOR WHOEVER PRESSED IT
      </Label>
      <Avatar cx={44} cy={166} r={14} initial="A" colour="brand" />
      <Avatar cx={80} cy={166} r={14} initial="R" colour="emerald" />
      <Avatar cx={116} cy={166} r={14} initial="P" colour="violet" />
      <Label x={140} y={166} size={11} tone="muted">
        everyone else stays where they were
      </Label>
      <Cursor x={196} y={70} name="You" />
    </Scene>
  );
}

/** The four session elements: a Timer, which is the clock itself, then the Stopwatch, Dot vote
 *  and Poll buttons, each labelled from its own setting. */
export function SessionButtons() {
  const cards: { kicker: string; action: string; icon: ReactNode }[] = [
    { kicker: 'START', action: 'a stopwatch', icon: <StopwatchGlyph /> },
    { kicker: 'START VOTE', action: '3 dots each', icon: <DotsGlyph /> },
    { kicker: 'ASK', action: 'Ready to ship?', icon: <PollGlyph /> },
  ];
  return (
    <Scene w={420} h={226}>
      {/* The Timer element: the same clock as the top-bar pill, idle at its length. */}
      <rect
        x={98}
        y={14}
        width={224}
        height={50}
        rx={12}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={114} y={40} size={13} weight={700} tone="muted">
        …
      </Label>
      <Chip x={146} y={39} r={13}>
        <HourglassGlyph />
      </Chip>
      <Label x={168} y={40} size={10} weight={600} tone="muted">
        TIMER
      </Label>
      <Label x={210} y={40} size={15} weight={700} tone="strong">
        5:00
      </Label>
      <circle cx={292} cy={39} r={11} className="fill-brand-500" />
      <path d="M288.5 33.5 L297 39 L288.5 44.5 Z" className="fill-white" />
      {cards.map((c, i) => {
        const cx = 34 + i * 122;
        return (
          <g key={c.kicker}>
            <rect
              x={cx}
              y={80}
              width={108}
              height={88}
              rx={10}
              className="fill-white stroke-brand-300"
              strokeWidth={2}
            />
            <Label x={cx + 96} y={92} anchor="middle" size={13} weight={700} tone="muted">
              …
            </Label>
            <Chip x={cx + 54} y={107}>
              {c.icon}
            </Chip>
            <Label x={cx + 54} y={137} anchor="middle" size={10} weight={600} tone="muted">
              {c.kicker}
            </Label>
            <Label x={cx + 54} y={153} anchor="middle" size={11} weight={700} tone="strong">
              {c.action}
            </Label>
          </g>
        );
      })}
      <Label x={210} y={192} anchor="middle" size={11} tone="body">
        Pressing one starts that tool for everyone in the room.
      </Label>
      <Label x={210} y={212} anchor="middle" size={10} tone="muted">
        The … menu holds the setting you change most.
      </Label>
    </Scene>
  );
}

/** The Done check: the ring with the count, who has finished, and who it is still waiting on. */
export function DoneCheckCard() {
  const x = 70;
  const y = 14;
  const w = 280;
  const ringX = x + 62;
  const ringY = y + 96;
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <Scene w={420} h={222}>
      <rect
        x={x}
        y={y}
        width={w}
        height={194}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={x + 14} y={y + 20} size={13} weight={700} tone="muted">
        …
      </Label>
      <Label x={x + 32} y={y + 20} size={12} weight={700} tone="strong">
        Everyone done?
      </Label>
      <Label x={x + w - 14} y={y + 20} anchor="end" size={11} weight={600} tone="accent">
        2/4
      </Label>
      {/* The ring fills as people finish, with the count in the middle. */}
      <circle cx={ringX} cy={ringY} r={r} className="fill-none stroke-slate-200" strokeWidth={7} />
      <circle
        cx={ringX}
        cy={ringY}
        r={r}
        className="fill-none stroke-brand-500"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${circ / 2} ${circ}`}
        transform={`rotate(-90 ${ringX} ${ringY})`}
      />
      <Label x={ringX} y={ringY + 1} anchor="middle" size={16} weight={700} tone="strong">
        2/4
      </Label>
      <Label x={x + 124} y={y + 50} size={10} weight={700} tone="muted">
        Done · 2
      </Label>
      <Avatar cx={x + 136} cy={y + 72} r={12} initial="A" colour="emerald" />
      <Avatar cx={x + 166} cy={y + 72} r={12} initial="R" colour="brand" />
      <Label x={x + 124} y={y + 104} size={10} weight={700} tone="muted">
        Waiting · 2
      </Label>
      <g opacity={0.45}>
        <Avatar cx={x + 136} cy={y + 126} r={12} initial="P" colour="slate" />
        <Avatar cx={x + 166} cy={y + 126} r={12} initial="J" colour="slate" />
      </g>
      <Button x={x + 14} y={y + 156} w={w - 28} h={26} label="I'm done" variant="primary" />
    </Scene>
  );
}

/** The five Reaction pads, with a burst going off over one of them. */
export function ReactionPads() {
  const pads: { label: string; icon: ReactNode }[] = [
    {
      label: 'Celebrate',
      icon: (
        <g>
          <rect
            x={-9}
            y={-8}
            width={5}
            height={7}
            rx={1}
            className="fill-rose-400"
            transform="rotate(-18)"
          />
          <rect
            x={-1}
            y={-9}
            width={5}
            height={7}
            rx={1}
            className="fill-amber-400"
            transform="rotate(12)"
          />
          <rect
            x={5}
            y={-2}
            width={5}
            height={7}
            rx={1}
            className="fill-emerald-400"
            transform="rotate(28)"
          />
          <rect
            x={-6}
            y={2}
            width={5}
            height={7}
            rx={1}
            className="fill-violet-400"
            transform="rotate(-6)"
          />
        </g>
      ),
    },
    {
      label: 'Nice one',
      icon: (
        <g className="fill-amber-400">
          <path d="M-3 -9 L-1 -3 L5 -1 L-1 1 L-3 7 L-5 1 L-11 -1 L-5 -3 Z" />
          <path d="M7 -8 L8 -5 L11 -4 L8 -3 L7 0 L6 -3 L3 -4 L6 -5 Z" />
        </g>
      ),
    },
    {
      label: 'Show some love',
      icon: (
        <path
          d="M0 8 C-9 1 -11 -3 -8.5 -6 C-6 -9 -1.5 -7.5 0 -4 C1.5 -7.5 6 -9 8.5 -6 C11 -3 9 1 0 8 Z"
          className="fill-rose-500"
        />
      ),
    },
    {
      label: 'Thanks',
      icon: (
        <g>
          <path
            d="M-6 8 L-9 -1 a2.4 2.4 0 0 1 3.6 -2.4 L-4 0 L-4.6 -7 a2.4 2.4 0 0 1 4.6 -0.8 L1 0 L2.4 -5.6 a2.4 2.4 0 0 1 4.4 1.4 L6 6 Z"
            className="fill-amber-400 stroke-amber-500"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <path
            d="M-11 -8 L-9 -6 M9 -8 L7 -6"
            className="stroke-amber-500"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      ),
    },
    {
      label: 'It shipped',
      icon: (
        <g className="stroke-violet-500" strokeWidth={1.8} strokeLinecap="round">
          <path d="M0 -9 V-4 M0 4 V9 M-9 0 H-4 M4 0 H9 M-6.4 -6.4 L-3.2 -3.2 M6.4 -6.4 L3.2 -3.2 M-6.4 6.4 L-3.2 3.2 M6.4 6.4 L3.2 3.2" />
          <circle r={2} className="fill-violet-500 stroke-none" />
        </g>
      ),
    },
  ];
  return (
    <Scene w={420} h={200}>
      {/* The burst: a moment over the pad, saved nowhere. */}
      <g className="fill-brand-300">
        <circle cx={122} cy={54} r={3} />
        <circle cx={158} cy={40} r={4} className="fill-amber-400" />
        <circle cx={196} cy={50} r={3} className="fill-rose-400" />
        <circle cx={230} cy={38} r={4} className="fill-emerald-400" />
        <circle cx={264} cy={56} r={3} className="fill-violet-400" />
        <circle cx={186} cy={26} r={2.5} className="fill-brand-400" />
      </g>
      {pads.map((p, i) => {
        // Each pad: the emoji over a glowing spot to stand on, its caption in a pill below.
        const cx = 50 + i * 80;
        const lit = i === 2;
        return (
          <g key={p.label}>
            <ellipse
              cx={cx}
              cy={122}
              rx={28}
              ry={9}
              className={lit ? 'fill-brand-200' : 'fill-brand-100'}
            />
            <g transform={`translate(${cx} 100)`}>{p.icon}</g>
            <rect
              x={cx - 38}
              y={134}
              width={76}
              height={16}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Label x={cx} y={143} anchor="middle" size={10} weight={600} tone="body">
              {p.label}
            </Label>
          </g>
        );
      })}
      <Label x={210} y={176} anchor="middle" size={11} tone="muted">
        Press a pad, or walk a character onto it in Avatar mode.
      </Label>
    </Scene>
  );
}

/** A Reveal zone before and after: the cover, and the same zone uncovered on
 *  one person's screen with the Hide pill. */
export function RevealZone() {
  return (
    <Scene w={420} h={196}>
      {/* Covered: an opaque panel lit by its accent, a solid border, a lock. */}
      <defs>
        <radialGradient id="reveal-glow" cx="0%" cy="0%" r="120%">
          <stop offset="0%" className="[stop-color:var(--color-brand-300)]" stopOpacity={0.55} />
          <stop offset="60%" className="[stop-color:var(--color-brand-100)]" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={20} y={38} width={170} height={110} rx={10} className="fill-slate-100" />
      <rect
        x={20}
        y={38}
        width={170}
        height={110}
        rx={10}
        fill="url(#reveal-glow)"
        className="stroke-brand-400"
        strokeWidth={1.5}
      />
      <circle cx={105} cy={70} r={12} className="fill-brand-100" />
      <rect
        x={101}
        y={69}
        width={8}
        height={6.5}
        rx={1.5}
        className="fill-none stroke-brand-600"
        strokeWidth={1.3}
      />
      <path
        d="M102.6 69v-2a2.4 2.4 0 0 1 4.8 0v2"
        className="fill-none stroke-brand-600"
        strokeWidth={1.3}
      />
      <Label x={105} y={98} anchor="middle" size={12} weight={700} tone="strong">
        Estimates
      </Label>
      <rect x={44} y={107} width={122} height={18} rx={9} className="fill-slate-200" />
      <Label x={105} y={116} anchor="middle" size={10} weight={600} tone="body">
        Double-click to reveal
      </Label>

      {/* Uncovered, for me only */}
      <rect
        x={230}
        y={38}
        width={170}
        height={110}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={248} y={70} size={12} weight={700} tone="strong">
        Estimates
      </Label>
      <TextBar x={248} y={88} w={110} />
      <TextBar x={248} y={104} w={84} />
      <TextBar x={248} y={120} w={98} />
      <g className="help-art-as-drawn">
        <rect x={336} y={46} width={56} height={18} rx={9} className="fill-slate-800" />
        <Eye x={349} y={55} off />
        <Label x={362} y={56} size={10} weight={600} tone="onAccent">
          Hide
        </Label>
      </g>
      <Label x={210} y={176} anchor="middle" size={10} tone="muted">
        Uncovering it this way changes only your own screen.
      </Label>
    </Scene>
  );
}

/** The Picker mid-roll: candidates flicking past, and the answer everyone
 *  lands on. */
export function PickerCard() {
  return (
    <Scene w={400} h={200}>
      {/* The reel, faded above and below the result */}
      <Label x={200} y={44} anchor="middle" size={11} tone="muted" className="fill-slate-300">
        Jamie
      </Label>
      <rect
        x={80}
        y={58}
        width={240}
        height={92}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={200} y={76} anchor="middle" size={10} weight={600} tone="muted">
        Who demos?
      </Label>
      <Avatar cx={158} cy={102} r={13} initial="P" colour="violet" />
      <Label x={182} y={103} size={16} weight={700} tone="strong">
        Priya
      </Label>
      <Button x={166} y={124} w={68} h={20} label="Again" variant="ghost" />
      <Label x={200} y={168} anchor="middle" size={11} tone="muted">
        It slows to a stop, and everyone sees the same answer.
      </Label>
    </Scene>
  );
}
