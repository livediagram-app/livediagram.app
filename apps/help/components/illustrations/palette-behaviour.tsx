// Behaviour-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/session-button.md
// and docs/specs/012-collaboration/picker.md): one scene per element that does something when somebody presses it,
// Session buttons and the Picker.
//
// One scene per sub-article, so each small article can show the surface it
// describes with the real labels the editor prints on it. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks (glyph chips).

import type { ReactNode } from 'react';

import { Scene, Label, Avatar, Button, } from './primitives';

// --- Small motifs the primitive kit does not carry -------------------------

/** A round glyph chip, the way a Session button draws its
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
/** A ticked circle, the Dot vote glyph. */
function VoteGlyph() {
  return (
    <Lucide>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Lucide>
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

/** The three session elements: a Timer, which is the clock itself, then the Stopwatch and Dot vote
 *  buttons, each labelled from its own setting. */
export function SessionButtons() {
  const cards: { kicker: string; action: string; icon: ReactNode }[] = [
    { kicker: 'START', action: 'a stopwatch', icon: <StopwatchGlyph /> },
    { kicker: 'START VOTE', action: '3 dots each', icon: <VoteGlyph /> },
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
      {/* The idle face's dial: ticks round the edge, no chip. */}
      <g className="stroke-brand-300" strokeWidth={1.5} strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M0 -12 V-9" transform={`translate(146 39) rotate(${i * 30})`} />
        ))}
      </g>
      <Label x={168} y={40} size={10} weight={600} tone="muted">
        TIMER
      </Label>
      <Label x={210} y={40} size={15} weight={700} tone="strong">
        5:00
      </Label>
      <circle cx={292} cy={39} r={11} className="fill-brand-500" />
      <path d="M288.5 33.5 L297 39 L288.5 44.5 Z" className="fill-white" />
      {cards.map((c, i) => {
        const cx = 95 + i * 122;
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
        WHO DEMOS?
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
