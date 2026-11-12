// The Behaviour elements somebody presses for a moment (docs/specs/009-elements/reaction-pad.md,
// docs/specs/012-collaboration/picker.md): the Reaction pads with a burst going off, a Reveal zone
// before and after, and the Picker mid-roll. Re-exported by palette-behaviour.tsx.

import type { ReactNode } from 'react';

import { Scene, Label, TextBar, Avatar, Button } from '@liveworkspace/help-site/art/primitives';
import { Eye } from './palette-behaviour-glyphs';

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
        Press a pad to throw a burst over the canvas.
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
