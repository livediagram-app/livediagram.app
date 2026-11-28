// The Session tab's pieces, as the editor draws them (liveplanner/docs/specs/026-plan/session-tabs.md "The page"):
// a queue row with its number or outcome glyph, the progress bar's segments, a chip, an action-bar button and the
// fill button in its three moments. ./session-tabs and ./session-kinds compose their scenes from these.

import type { ReactNode } from 'react';
import { DiscText, Label } from '@liveworkspace/help-site/art/primitives';

// The outcome a row shows in place of its number (OUTCOME_LOOKS): a tick for the completing one, a skip arrow, a flag.
export type RowMark = 'tick' | 'skip' | 'flag' | 'close';

const MARK_CLASS: Record<RowMark, string> = {
  tick: 'stroke-brand-600',
  skip: 'stroke-slate-500',
  flag: 'stroke-rose-500',
  close: 'stroke-rose-500',
};

/** An outcome's glyph, centred on (cx, cy), about 9 units across. */
export function MarkGlyph({ cx, cy, mark }: { cx: number; cy: number; mark: RowMark }) {
  const d = {
    tick: `M${cx - 4} ${cy}l2.8 2.8 5.2-5.6`,
    skip: `M${cx - 4} ${cy - 4}l5.5 4-5.5 4z M${cx + 3.5} ${cy - 4}v8`,
    flag: `M${cx - 3.5} ${cy + 4.5}v-9 M${cx - 3.5} ${cy - 4.5}h7l-1.8 2.6 1.8 2.6h-7`,
    close: `M${cx - 3.5} ${cy - 3.5}l7 7 M${cx + 3.5} ${cy - 3.5}l-7 7`,
  }[mark];
  return (
    <path
      d={d}
      fill="none"
      className={MARK_CLASS[mark]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** One queue row: its type's edge, its number (filled for the room's card) or its outcome, the card's number and
 *  title, greyed once decided; `aside` draws on its right (an estimate or priority pill, a presenter disc). */
export function QueueRow({
  x,
  y,
  w,
  place,
  cardRef,
  title,
  edge = 'fill-sky-500',
  mark,
  current = false,
  aside,
}: {
  x: number;
  y: number;
  w: number;
  place: number;
  cardRef: string;
  title: string;
  edge?: string;
  mark?: RowMark;
  current?: boolean;
  aside?: ReactNode;
}) {
  return (
    <g opacity={mark && !current ? 0.6 : 1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={28}
        rx={6}
        className={current ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-transparent'}
        strokeWidth={0.75}
      />
      <rect x={x} y={y + 6} width={2.5} height={16} rx={1.25} className={edge} />
      <circle
        cx={x + 15}
        cy={y + 14}
        r={7.5}
        className={current && !mark ? 'fill-brand-700' : 'fill-slate-100'}
      />
      {mark ? (
        <MarkGlyph cx={x + 15} cy={y + 14} mark={mark} />
      ) : (
        <DiscText
          cx={x + 15}
          cy={y + 14}
          size={8}
          className={current ? 'fill-white help-art-as-drawn' : 'fill-slate-600'}
        >
          {place}
        </DiscText>
      )}
      <Label x={x + 28} y={y + 9} size={7.5} weight={500} tone="muted">
        {cardRef}
      </Label>
      <Label x={x + 28} y={y + 19.5} size={9} weight={500} tone="strong">
        {title}
      </Label>
      {aside}
    </g>
  );
}

// A progress segment's look: decided by the completing outcome, skipped, flagged, the room's card, or still to go.
export type Segment = 'done' | 'skip' | 'flag' | 'current' | 'todo';
const SEGMENT_CLASS: Record<Segment, string> = {
  done: 'fill-brand-600',
  skip: 'fill-slate-400',
  flag: 'fill-rose-500',
  current: 'fill-brand-200',
  todo: 'fill-slate-100',
};

/** The progress bar: one segment per card (or per person in a Stand-up), across `w`. */
export function ProgressBar({
  x,
  y,
  w,
  segments,
}: {
  x: number;
  y: number;
  w: number;
  segments: readonly Segment[];
}) {
  const gap = 2;
  const each = (w - gap * (segments.length - 1)) / segments.length;
  return (
    <g>
      {segments.map((s, i) => (
        <rect
          key={i}
          x={x + i * (each + gap)}
          y={y}
          width={each}
          height={5}
          rx={2.5}
          className={SEGMENT_CLASS[s]}
        />
      ))}
    </g>
  );
}

/** A small rounded pill: a set-up chip, a reason chip, an estimate chip. `on` tints and ticks it. */
export function Chip({
  x,
  y,
  label,
  on = false,
  count,
  w,
}: {
  x: number;
  y: number;
  label: string;
  on?: boolean;
  count?: number;
  w?: number;
}) {
  const width = w ?? chipWidth(label, on, count);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={18}
        rx={9}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
        strokeWidth={0.75}
      />
      {on ? (
        <path
          d={`M${x + 8} ${y + 9}l2.4 2.4 4.4-4.8`}
          fill="none"
          className="stroke-brand-700"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <Label
        x={w ? x + width / 2 + (on ? 5 : 0) : x + (on ? 18 : 9)}
        y={y + 9.5}
        size={9}
        weight={500}
        anchor={w ? 'middle' : 'start'}
        className={on ? 'fill-brand-800' : 'fill-slate-600'}
      >
        {label}
      </Label>
      {count !== undefined ? (
        <Label x={x + width - 9} y={y + 9.5} size={8.5} anchor="end" tone="muted">
          {count}
        </Label>
      ) : null}
    </g>
  );
}

/** How wide a chip draws for its label, so a row of them can be laid out end to end. */
export function chipWidth(label: string, on = false, count?: number): number {
  return label.length * 5.2 + (on ? 26 : 18) + (count !== undefined ? 14 : 0);
}

/** A row of chips laid end to end from x, 5 units apart. */
export function ChipRow({
  x,
  y,
  chips,
}: {
  x: number;
  y: number;
  chips: readonly { label: string; on?: boolean; count?: number }[];
}) {
  // Each chip starts where the one before it ends, 5 units on.
  const starts = chips.reduce<number[]>((xs, _, i) => {
    const prev = chips[i - 1];
    xs.push(prev ? xs[i - 1]! + chipWidth(prev.label, prev.on, prev.count) + 5 : x);
    return xs;
  }, []);
  return (
    <g>
      {chips.map((c, i) => (
        <Chip key={c.label} x={starts[i]!} y={y} {...c} />
      ))}
    </g>
  );
}

/** A quiet action-bar button: its glyph (an outcome's mark) and its name. */
export function BarButton({
  x,
  y,
  w,
  label,
  mark,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  mark?: RowMark;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      {mark ? <MarkGlyph cx={x + 13} cy={y + 12} mark={mark} /> : null}
      <Label
        x={mark ? x + 23 : x + w / 2}
        y={y + 12.5}
        size={9.5}
        weight={600}
        anchor={mark ? 'start' : 'middle'}
      >
        {label}
      </Label>
    </g>
  );
}

/** The fill button (FillActionButton): `idle` shows its label and key, `fill` the accent wash running left to right
 *  over it, `tick` the label swapped for a tick. */
export function FillButton({
  x,
  y,
  w,
  label,
  shortcut,
  phase = 'idle',
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  shortcut?: string;
  phase?: 'idle' | 'fill' | 'tick';
}) {
  const h = 26;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} className="fill-brand-700" />
      {phase === 'fill' ? (
        <rect
          x={x}
          y={y}
          width={w * 0.62}
          height={h}
          rx={7}
          className="fill-white/30 help-art-as-drawn"
        />
      ) : null}
      {phase === 'tick' ? (
        <path
          d={`M${x + w / 2 - 6} ${y + 13}l4 4 8-8.5`}
          fill="none"
          className="stroke-white help-art-as-drawn"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Label
            x={x + w / 2 - (shortcut ? 7 : 0)}
            y={y + 13.5}
            size={10.5}
            weight={600}
            anchor="middle"
            tone="onAccent"
          >
            {label}
          </Label>
          {shortcut ? (
            <g>
              <rect
                x={x + w / 2 + label.length * 3 - 3}
                y={y + 7}
                width={12}
                height={12}
                rx={3}
                className="fill-white/20 help-art-as-drawn"
              />
              <Label
                x={x + w / 2 + label.length * 3 + 3}
                y={y + 13.5}
                size={8}
                weight={500}
                anchor="middle"
                tone="onAccent"
              >
                {shortcut}
              </Label>
            </g>
          ) : null}
        </>
      )}
    </g>
  );
}

/** A small pill at the right of a queue row (an estimate, a priority); `dashed` draws the "?" a missing value shows. */
export function RowPill({
  x,
  y,
  label,
  tone = 'slate',
  dashed = false,
}: {
  x: number;
  y: number;
  label: string;
  tone?: 'slate' | 'rose' | 'amber' | 'sky';
  dashed?: boolean;
}) {
  const face = {
    slate: 'fill-slate-100 stroke-transparent',
    rose: 'fill-rose-50 stroke-rose-200',
    amber: 'fill-amber-50 stroke-amber-200',
    sky: 'fill-sky-50 stroke-sky-200',
  }[tone];
  const ink = {
    slate: 'fill-slate-600',
    rose: 'fill-rose-700',
    amber: 'fill-amber-700',
    sky: 'fill-sky-700',
  }[tone];
  const w = Math.max(16, label.length * 5 + 9);
  return (
    <g>
      <rect
        x={x - w}
        y={y}
        width={w}
        height={14}
        rx={7}
        className={dashed ? 'fill-white stroke-slate-300' : face}
        strokeWidth={0.75}
        strokeDasharray={dashed ? '2 1.5' : undefined}
      />
      <Label
        x={x - w / 2}
        y={y + 7.5}
        size={8}
        weight={600}
        anchor="middle"
        className={dashed ? 'fill-slate-400' : ink}
      >
        {label}
      </Label>
    </g>
  );
}

/** The sidebar's header: the kind and how far through, the set-up in words, and the facilitator's chip. */
export function SidebarHeader({
  x,
  y,
  kind,
  count,
  line,
  facilitator = 'Sam',
}: {
  x: number;
  y: number;
  kind: string;
  count: string;
  line: string;
  facilitator?: string;
}) {
  return (
    <g>
      <Label x={x} y={y} size={11} weight={700} tone="strong">
        {kind}
      </Label>
      <Label x={x + kind.length * 6.4 + 6} y={y + 0.5} size={9} weight={500} tone="muted">
        {count}
      </Label>
      <Label x={x} y={y + 14} size={8.5} tone="muted">
        {line}
      </Label>
      <rect
        x={x}
        y={y + 23}
        width={facilitator.length * 5.4 + 70}
        height={16}
        rx={8}
        className="fill-slate-100"
      />
      <circle cx={x + 9} cy={y + 31} r={3} className="fill-emerald-500" />
      <Label x={x + 16} y={y + 31.5} size={8.5} weight={500}>
        {facilitator} is facilitating
      </Label>
    </g>
  );
}
