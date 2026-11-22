import type { ReactNode } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';
import { HAIR, Surface, Tick, runningStarts } from './kit-base';

// The pieces drawn inside liveknowledge's figures (kit.tsx): a page's head and its verified badge, dialogs,
// choice and menu rows, stacked bars, fields and faces.

export function PageHead({
  x,
  y,
  title,
  crumb,
  children,
}: {
  x: number;
  y: number;
  title: string;
  crumb?: string;
  /** The meta row, drawn at y + 31 by the caller. */
  children?: ReactNode;
}) {
  return (
    <g>
      {crumb ? (
        <Label x={x} y={y} size={6.5} tone="muted">
          {crumb}
        </Label>
      ) : null}
      <Label x={x} y={y + 14} size={14} weight={800} tone="strong">
        {title}
      </Label>
      {children}
    </g>
  );
}

/** The meta row's Verified badge: a pale brand pill holding the tick and "Verified by <name>", then what follows
 *  after a dot. Its left edge is `x`, its middle `y`. */
export function VerifiedBadge({
  x,
  y,
  by = 'Maya',
  after,
}: {
  x: number;
  y: number;
  by?: string;
  after?: string;
}) {
  const text = `Verified by ${by}`;
  const w = Math.ceil(text.length * 4.1 + 20);
  return (
    <g>
      <rect x={x} y={y - 6.5} width={w} height={13} rx={6.5} className="fill-brand-100" />
      <Tick cx={x + 8} cy={y} r={3} className="stroke-brand-700" />
      <Label x={x + 15} y={y + 0.4} size={7.5} weight={600} className="fill-brand-800">
        {text}
      </Label>
      {after ? (
        <Label x={x + w + 5} y={y + 0.4} size={7.5} tone="muted">
          {`· ${after}`}
        </Label>
      ) : null}
    </g>
  );
}

/** The width VerifiedBadge takes for `by`, so a caller can place what follows it. */
export const verifiedBadgeWidth = (by = 'Maya'): number =>
  Math.ceil(`Verified by ${by}`.length * 4.1 + 20);

/** A dialog's card: a title, an optional line under it, and its body. Centred by the caller. */
export function DialogCard({
  x,
  y,
  w,
  h,
  title,
  line,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  line?: string;
  children?: ReactNode;
}) {
  return (
    <Surface x={x} y={y} w={w} h={h} r={10} lift>
      <Label x={x + 14} y={y + 16} size={10.5} weight={700} tone="strong">
        {title}
      </Label>
      {line ? (
        <Label x={x + 14} y={y + 29} size={7.5} tone="muted">
          {line}
        </Label>
      ) : null}
      {/* Close. */}
      <path
        d={`M${x + w - 17} ${y + 12.5} l6 6 M${x + w - 11} ${y + 12.5} l-6 6`}
        className="stroke-slate-400"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      {children}
    </Surface>
  );
}

/** A bordered single-choice row: a radio at the left, a label, and a tick when it is the chosen one. */
export function ChoiceRow({
  x,
  y,
  w,
  h = 16,
  label,
  note,
  chosen = false,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  note?: string;
  chosen?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className={chosen ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={chosen ? 1.1 : HAIR}
      />
      <Label x={x + 9} y={y + h / 2 + 0.4} size={8} weight={chosen ? 700 : 500} tone="strong">
        {label}
      </Label>
      {note ? (
        <Label x={x + w - (chosen ? 20 : 9)} y={y + h / 2 + 0.4} anchor="end" size={7} tone="muted">
          {note}
        </Label>
      ) : null}
      {chosen ? <Tick cx={x + w - 10} cy={y + h / 2} r={3.4} className="stroke-brand-600" /> : null}
    </g>
  );
}

/** A menu's row: a small glyph square at its left and a verb. `muted` greys a verb that cannot run. */
export function MenuRows({
  x,
  y,
  w,
  rows,
}: {
  x: number;
  y: number;
  w: number;
  rows: readonly (
    { label: string; hover?: boolean; muted?: boolean; ticked?: boolean } | 'separator'
  )[];
}) {
  const tops = runningStarts(
    y,
    rows.map((row) => (row === 'separator' ? 5 : 13)),
  );
  return (
    <>
      {rows.map((row, i) => {
        const at = tops[i]!;
        if (row === 'separator') {
          const line = (
            <line
              key={i}
              x1={x + 4}
              y1={at + 2.5}
              x2={x + w - 4}
              y2={at + 2.5}
              className="stroke-slate-200"
              strokeWidth={HAIR}
            />
          );
          return line;
        }
        const top = at;
        return (
          <g key={i} opacity={row.muted ? 0.45 : 1}>
            {row.hover ? (
              <rect
                x={x + 3}
                y={top}
                width={w - 6}
                height={13}
                rx={3.5}
                className="fill-slate-100"
              />
            ) : null}
            <rect
              x={x + 8}
              y={top + 3.5}
              width={6}
              height={6}
              rx={1.5}
              className="fill-none stroke-slate-400"
              strokeWidth={1}
            />
            <Label x={x + 19} y={top + 6.9} size={7.5} weight={500} tone="strong">
              {row.label}
            </Label>
            {row.ticked ? (
              <Tick cx={x + w - 10} cy={top + 6.5} r={3} className="stroke-brand-600" />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/** A stacked bar of parts that sum to its width: Knowledge Health, a budget. */
export function StackedBar({
  x,
  y,
  w,
  h = 6,
  parts,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  /** Each part's share (0 to 1) and its fill; a remainder is left as the track. */
  parts: readonly { share: number; className: string }[];
}) {
  const lefts = runningStarts(
    x,
    parts.map((part) => w * part.share),
  );
  const id = `kb-bar-${x}-${y}-${w}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} rx={h / 2} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} className="fill-slate-100" />
      <g clipPath={`url(#${id})`}>
        {parts.map((part, i) => (
          <rect
            key={i}
            x={lefts[i]}
            y={y}
            width={w * part.share}
            height={h}
            className={part.className}
          />
        ))}
      </g>
    </g>
  );
}

/** A labelled row of a card: the label at the left in muted ink, the value at the right. */
export function FieldRow({
  x,
  y,
  w,
  label,
  value,
  valueClass = 'fill-slate-800',
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <g>
      <Label x={x} y={y} size={7} tone="muted">
        {label}
      </Label>
      <Label x={x + w} y={y} anchor="end" size={7} weight={600} className={valueClass}>
        {value}
      </Label>
    </g>
  );
}

/** A small avatar disc with an initial. */
export function Face({
  cx,
  cy,
  r = 5.5,
  initial,
  className = 'fill-violet-500 dark:fill-violet-700',
}: {
  cx: number;
  cy: number;
  r?: number;
  initial: string;
  className?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={className} />
      <Label
        x={cx}
        y={cy + 0.5}
        anchor="middle"
        size={r * 1.15}
        weight={700}
        className="fill-white help-art-as-drawn"
      >
        {initial}
      </Label>
    </g>
  );
}
