// The drawing parts the Session tabs illustrations (./plan-sessions.tsx) are built from, in the cards' 300 by 96
// viewBox: a queue row with its outcome mark, the progress bar, a quiet bar button and the fill button that plays
// the editor's press on a loop (fa-s-* in app/feature-art/features.css).
import { MUTED, TEXT } from './canvas-parts';
import { TYPE } from './plan-parts';

export const ACCENT = 'fill-brand-700 dark:fill-brand-600';
export const TINT =
  'fill-brand-50 stroke-brand-300 dark:fill-brand-500/20 dark:stroke-brand-500/60';
const SLATE = '#64748b';
const FLAG = '#e11d48';

// An outcome's glyph in a queue row's disc: a tick, a skip arrow or a flag, centred on (cx, cy).
function Mark({ cx, cy, mark }: { cx: number; cy: number; mark: 'tick' | 'skip' | 'flag' }) {
  const d = {
    tick: `M${cx - 2.4} ${cy}l1.7 1.7 3.1-3.4`,
    skip: `M${cx - 2.4} ${cy - 2.4}l3.3 2.4-3.3 2.4z M${cx + 2.1} ${cy - 2.4}v4.8`,
    flag: `M${cx - 2} ${cy + 2.6}v-5.2 M${cx - 2} ${cy - 2.6}h4l-1 1.5 1 1.5h-4`,
  }[mark];
  const colour = { tick: undefined, skip: SLATE, flag: FLAG }[mark];
  return (
    <path
      d={d}
      fill="none"
      className={colour ? undefined : 'stroke-brand-600 dark:stroke-brand-300'}
      stroke={colour}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// One queue row: the type's edge, the number (filled for the room's card) or the outcome, and the card's title.
export function Row({
  x,
  y,
  w,
  n,
  title,
  mark,
  current = false,
  edge = TYPE.task,
}: {
  x: number;
  y: number;
  w: number;
  n: number;
  title: string;
  mark?: 'tick' | 'skip' | 'flag';
  current?: boolean;
  edge?: string;
}) {
  return (
    <g opacity={mark ? 0.6 : 1}>
      <rect
        className={current ? TINT : 'fill-none stroke-none'}
        x={x}
        y={y}
        width={w}
        height={13}
        rx="3"
        strokeWidth="0.6"
      />
      <rect x={x} y={y + 2.5} width="1.4" height="8" rx="0.7" fill={edge} />
      <circle
        cx={x + 8}
        cy={y + 6.5}
        r="3.6"
        className={current ? ACCENT : 'fill-slate-100 dark:fill-slate-700'}
      />
      {mark ? (
        <Mark cx={x + 8} cy={y + 6.5} mark={mark} />
      ) : (
        <text
          x={x + 8}
          y={y + 8.3}
          fontSize="4.6"
          fontWeight="700"
          textAnchor="middle"
          className={current ? 'fill-white' : MUTED}
        >
          {n}
        </text>
      )}
      <text className={TEXT} x={x + 15} y={y + 8.6} fontSize="5.6" fontWeight="600">
        {title}
      </text>
    </g>
  );
}

// The fill button, playing its press on a loop: the wash runs across, the label gives way to a tick, then it drains.
export function FillButton({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect className={ACCENT} x={x} y={y} width={w} height={14} rx="3.5" />
      <rect className="fa-s-wash fill-white/35" x={x} y={y} width={w} height={14} rx="3.5" />
      <text
        className="fa-s-label fill-white"
        x={x + w / 2}
        y={y + 9.4}
        fontSize="6.2"
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </text>
      <path
        className="fa-s-tick stroke-white"
        d={`M${x + w / 2 - 3.5} ${y + 7}l2.4 2.4 4.6-4.8`}
        fill="none"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

// A progress bar of `segments`, across `w` from (x, y).
export function Progress({
  x,
  y,
  w,
  segments,
}: {
  x: number;
  y: number;
  w: number;
  segments: readonly ('done' | 'skip' | 'flag' | 'current' | 'todo')[];
}) {
  const gap = 1.2;
  const each = (w - gap * (segments.length - 1)) / segments.length;
  const look = {
    done: 'fill-brand-600 dark:fill-brand-400',
    skip: 'fill-slate-400 dark:fill-slate-500',
    flag: 'fill-rose-600 dark:fill-rose-400',
    current: 'fill-brand-200 dark:fill-brand-500/40',
    todo: 'fill-slate-100 dark:fill-slate-700',
  };
  return (
    <g>
      {segments.map((s, i) => (
        <rect
          key={i}
          className={look[s]}
          x={x + i * (each + gap)}
          y={y}
          width={each}
          height="2.6"
          rx="1.3"
        />
      ))}
    </g>
  );
}

// A quiet bar button: its glyph and its name.
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
  mark?: 'skip' | 'flag';
}) {
  return (
    <g>
      <rect
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        x={x}
        y={y}
        width={w}
        height={14}
        rx="3.5"
        strokeWidth="0.6"
      />
      {mark ? <Mark cx={x + 6.5} cy={y + 7} mark={mark} /> : null}
      <text
        className={TEXT}
        x={mark ? x + 11.5 : x + w / 2}
        y={y + 9.2}
        fontSize="5.6"
        fontWeight="600"
        textAnchor={mark ? 'start' : 'middle'}
      >
        {label}
      </text>
    </g>
  );
}
