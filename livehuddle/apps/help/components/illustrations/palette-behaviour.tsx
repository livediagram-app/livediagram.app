// Meeting-element illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/009-elements/mode-button.md and
// docs/specs/009-elements/reaction-pad.md): the meeting palette's Navigate, React and Selection Mode categories, plus
// one scene per element that does something when somebody presses it: Selection Mode buttons and Reaction Pads.
//
// One scene per sub-article, so each small article can show the surface it
// describes with the real labels the editor prints on it. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks (glyph chips,
// confetti).

import type { ReactNode } from 'react';

import {
  Scene,
  Label,
  TextBar,
  Avatar,
  Panel,
  Cursor,
} from '@liveworkspace/help-site/art/primitives';

// --- Small motifs the primitive kit does not carry -------------------------

/** A round glyph chip, the way a Selection Mode button draws its tool icon above
 *  the words. */
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
/** A 24-unit editor glyph, scaled down onto a chip. */
function Lucide({ children }: { children: ReactNode }) {
  return (
    <g
      transform="scale(0.68) translate(-12 -12)"
      className="stroke-brand-600"
      strokeWidth={2.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}
/** A smile, the React group glyph. */
function SmileGlyph() {
  return (
    <Lucide>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </Lucide>
  );
}
/** An arrow through a doorway, the Navigate group glyph. */
function DoorGlyph() {
  return (
    <Lucide>
      <path d="M4 20V6.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V20" />
      <path d="M2.6 20h12.8M17 9.5h4.4M19.2 7.3l2.2 2.2-2.2 2.2" />
    </Lucide>
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

// --- Scenes ----------------------------------------------------------------

/** The meeting palette's Meet band on the strip: **Navigate**, **React** and **Selection Mode**, one of them open
 *  (the first named in `lit`, else Navigate) with its elements in the flyout under it. */
export function MeetingCategories({ lit = [] }: { lit?: readonly string[] }) {
  const categories: { label: string; icon: ReactNode; x: number; w: number }[] = [
    { label: 'Navigate', icon: <DoorGlyph />, x: 92, w: 82 },
    { label: 'React', icon: <SmileGlyph />, x: 178, w: 66 },
    { label: 'Selection Mode', icon: <SelectGlyph />, x: 248, w: 112 },
  ];
  const open = categories.find((c) => lit.includes(c.label)) ?? categories[0]!;
  return (
    <Scene w={420} h={236} bg="plain">
      {/* The Meet band of the strip, the open category pressed. */}
      <rect
        x={86}
        y={10}
        width={280}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {categories.map((c) => {
        const on = c === open;
        return (
          <g key={c.label}>
            {on ? (
              <rect x={c.x} y={14} width={c.w} height={24} rx={6} className="fill-brand-100" />
            ) : null}
            <Chip x={c.x + 14} y={26} r={8}>
              {c.icon}
            </Chip>
            <Label
              x={c.x + 26}
              y={30}
              size={10}
              weight={on ? 700 : 500}
              className={on ? 'fill-brand-700' : 'fill-slate-600'}
            >
              {c.label}
            </Label>
            {on ? (
              <rect
                x={c.x + 6}
                y={37}
                width={c.w - 12}
                height={2}
                rx={1}
                className="fill-brand-500"
              />
            ) : null}
          </g>
        );
      })}
      {/* The open category's flyout: its elements, one row each. */}
      <Panel x={86} y={50} w={280} h={176}>
        <Label x={100} y={70} size={10} weight={700} tone="strong">
          {open.label}
        </Label>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={100}
              y={82 + i * 44}
              width={252}
              height={36}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Chip x={118} y={100 + i * 44} r={10}>
              {open.icon}
            </Chip>
            <TextBar x={134} y={93 + i * 44} w={96} tone="muted" />
            <TextBar x={134} y={104 + i * 44} w={150} tone="faint" />
          </g>
        ))}
      </Panel>
    </Scene>
  );
}

/** A control bar of Selection Mode buttons across the top of a canvas: two
 *  offering a mode, one offering the way back out. */
export function ModeButtonBar() {
  // The face: the icon chip that is the button, a small capitalised kicker,
  // then the mode in bold. A button for the mode you are in says LEAVE.
  const buttons: { kicker: string; mode: string; icon: ReactNode }[] = [
    { kicker: 'SWITCH TO', mode: 'Select', icon: <SelectGlyph /> },
    { kicker: 'SWITCH TO', mode: 'Laser', icon: <LaserGlyph /> },
    { kicker: 'LEAVE', mode: 'Avatar', icon: <AvatarGlyph /> },
  ];
  return (
    <Scene w={420} h={218}>
      {buttons.map((b, i) => {
        const bx = 26 + i * 126;
        return (
          <g key={b.mode}>
            <rect
              x={bx}
              y={20}
              width={112}
              height={80}
              rx={10}
              className="fill-white stroke-slate-300"
              strokeWidth={2}
            />
            <Chip x={bx + 56} y={45}>
              {b.icon}
            </Chip>
            <Label x={bx + 56} y={74} anchor="middle" size={8} weight={600} tone="muted">
              {b.kicker}
            </Label>
            <Label x={bx + 56} y={88} anchor="middle" size={11} weight={700} tone="strong">
              {b.mode}
            </Label>
          </g>
        );
      })}
      <Label x={26} y={132} size={10} weight={700} tone="muted">
        THE MODE CHANGES FOR WHOEVER PRESSED IT
      </Label>
      <Avatar cx={44} cy={174} r={14} initial="A" colour="brand" />
      <Avatar cx={80} cy={174} r={14} initial="R" colour="emerald" />
      <Avatar cx={116} cy={174} r={14} initial="P" colour="violet" />
      <Label x={140} y={174} size={11} tone="muted">
        everyone else stays where they were
      </Label>
      <Cursor x={216} y={44} name="You" />
    </Scene>
  );
}

/** The five Reaction pads, with a burst going off over one of them. */
const PAD_LEFT = 9;
const PAD_GAP = 10;
const pillWidth = (label: string) => label.length * 6 + 16;

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
          className="fill-violet-500"
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
  // Each pill sized to its own label, so the longest never runs into its neighbours.
  const centres = pads.map(
    (_, i) =>
      pads.slice(0, i).reduce((x, q) => x + pillWidth(q.label) + PAD_GAP, PAD_LEFT) +
      pillWidth(pads[i]!.label) / 2,
  );
  const lit = 2;
  return (
    <Scene w={420} h={200}>
      {/* The burst: the lit pad's own emoji thrown up over it, saved nowhere. */}
      {(
        [
          [-34, 66, 0.7, -18],
          [-14, 44, 0.9, -8],
          [10, 36, 1, 10],
          [30, 58, 0.75, 20],
          [-2, 70, 0.6, 4],
        ] as const
      ).map(([dx, y, k, turn]) => (
        <path
          key={`${dx}-${y}`}
          d="M0 8 C-9 1 -11 -3 -8.5 -6 C-6 -9 -1.5 -7.5 0 -4 C1.5 -7.5 6 -9 8.5 -6 C11 -3 9 1 0 8 Z"
          transform={`translate(${centres[lit]! + dx} ${y}) rotate(${turn}) scale(${k})`}
          className="fill-violet-400"
          fillOpacity={0.85}
        />
      ))}
      {pads.map((p, i) => {
        // Each pad: the emoji over a glowing spot to stand on, its caption in a pill below.
        const w = pillWidth(p.label);
        const cx = centres[i]!;
        const on = i === lit;
        return (
          <g key={p.label}>
            <ellipse
              cx={cx}
              cy={122}
              rx={28}
              ry={9}
              className={on ? 'fill-brand-200' : 'fill-brand-100'}
            />
            <g transform={`translate(${cx} 100)`}>{p.icon}</g>
            <rect
              x={cx - w / 2}
              y={134}
              width={w}
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
