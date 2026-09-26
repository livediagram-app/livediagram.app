// The Q&A board's small parts (spec/151): its glyphs, the author chip, the
// vote pill and the relative-time label. Shared by the spotlight, the queue
// rows and the Discussed drawer so the three read as one object.

import { useEffect, useRef, useState } from 'react';
import type { QaNote } from '@livediagram/diagram';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { Tooltip } from '@/components/primitives/Tooltip';
import { tint } from '../collab-chrome';

// One accent for the board, readable on light and dark themes alike. The
// theme owns the card; the accent only marks what is YOURS and what is LIVE.
export const QA_ACCENT = '#6d5efc';

// Every control on the board stops the pointer at itself: a press on a vote
// must not also select the board, which would put your name on it through the
// spec/07 selection ring at the moment you vote (the Idea box's reasoning,
// spec/125) and take the lock away from whoever is holding it.
export const stopPointer = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

type Glyph = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);
export const UpGlyph = ({ size = 12 }: Glyph) => svg(size, <path d="M3.5 10 8 5.5l4.5 4.5" />);
export const CheckGlyph = ({ size = 12 }: Glyph) => svg(size, <path d="m3.5 8.5 3 3 6-7" />);
export const TrashGlyph = ({ size = 12 }: Glyph) =>
  svg(size, <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />);
export const ReopenGlyph = ({ size = 12 }: Glyph) =>
  svg(size, <path d="M4 6.5A4.5 4.5 0 1 1 3.5 10M4 3v3.5h3.5" />);
export const SendGlyph = ({ size = 12 }: Glyph) =>
  svg(size, <path d="M8 13V3.5M3.8 7.5 8 3.3l4.2 4.2" />);
export const ChevronGlyph = ({ size = 12, open }: Glyph & { open: boolean }) => (
  <span
    className="inline-flex transition-transform duration-200"
    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
  >
    {svg(size, <path d="m4 6 4 4 4-4" />)}
  </span>
);
// A speech bubble with a typing ellipsis: "talk about this one now", the same
// word the spotlight it sends the note to wears ("Now discussing").
export const DiscussGlyph = ({ size = 12 }: Glyph) =>
  svg(
    size,
    <>
      <path d="M3 2.8h10a1.2 1.2 0 0 1 1.2 1.2v6.2a1.2 1.2 0 0 1-1.2 1.2H7.4L4.2 14v-2.6H3a1.2 1.2 0 0 1-1.2-1.2V4A1.2 1.2 0 0 1 3 2.8Z" />
      <circle cx="5.4" cy="7.1" r=".85" fill="currentColor" stroke="none" />
      <circle cx="8" cy="7.1" r=".85" fill="currentColor" stroke="none" />
      <circle cx="10.6" cy="7.1" r=".85" fill="currentColor" stroke="none" />
    </>,
  );

// Incognito: a hat pulled low over dark glasses, for an anonymous author. (A
// domino mask was tried first and read as an infinity sign at 10px.)
export const MaskGlyph = ({ size = 12 }: Glyph) =>
  svg(
    size,
    <>
      <path d="M1.8 7.6h12.4" />
      <path d="M4 7.6 5.2 3.4h5.6L12 7.6" />
      <circle cx="5" cy="11" r="1.9" />
      <circle cx="11" cy="11" r="1.9" />
      <path d="M6.9 11h2.2" />
    </>,
  );

export function relTime(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// Who wrote it: an initial in their colour, or the mask.
export function AuthorChip({
  note,
  textColor,
  size = 16,
}: {
  note: QaNote;
  textColor: string;
  size?: number;
}) {
  if (!note.author) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1" style={{ color: textColor }}>
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full"
          style={{ width: size, height: size, backgroundColor: tint(textColor, 0.1) }}
        >
          <MaskGlyph size={size * 0.7} />
        </span>
        <span className="truncate opacity-60">Anonymous</span>
      </span>
    );
  }
  const initial = note.author.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="inline-flex min-w-0 items-center gap-1" style={{ color: textColor }}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.55,
          backgroundColor: note.author.color,
        }}
      >
        {initial}
      </span>
      <span className="truncate opacity-70">{note.author.name}</span>
    </span>
  );
}

// The vote control: a chevron over the count. Filled in the accent when the
// vote is yours. Pressing it pops the pill and lifts a "+1" off it, so a vote
// is felt as well as counted.
export function VotePill({
  count,
  mine,
  onToggle,
  textColor,
  frozen,
  large,
}: {
  count: number;
  mine: boolean;
  onToggle?: () => void;
  textColor: string;
  // A closed note: the count, with no control.
  frozen?: boolean;
  large?: boolean;
}) {
  const [burst, setBurst] = useState(0);
  const [popping, setPopping] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const press = usePressWithoutDrag(() => {
    if (!onToggle) return;
    if (!mine) setBurst((b) => b + 1);
    setPopping(false);
    // Next frame, so a quick second press restarts the pop rather than
    // landing mid-animation.
    requestAnimationFrame(() => setPopping(true));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPopping(false), 400);
    onToggle();
  });

  const w = large ? 44 : 36;
  const body = (
    <button
      type="button"
      {...press}
      {...stopPointer}
      disabled={frozen || !onToggle}
      aria-pressed={mine}
      aria-label={mine ? `Withdraw your vote (${count})` : `Upvote (${count})`}
      className={`pointer-events-auto relative flex shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border font-bold tabular-nums transition-colors disabled:cursor-default ${popping ? 'qa-pop' : ''}`}
      style={{
        width: w,
        height: large ? 50 : 42,
        fontSize: large ? 15 : 13,
        color: mine ? '#fff' : textColor,
        backgroundColor: mine ? QA_ACCENT : tint(textColor, frozen ? 0.04 : 0.06),
        borderColor: mine ? QA_ACCENT : tint(textColor, frozen ? 0.08 : 0.16),
        boxShadow: mine ? `0 4px 12px -4px ${QA_ACCENT}` : undefined,
        opacity: frozen ? 0.7 : 1,
      }}
    >
      {frozen ? <CheckGlyph size={11} /> : <UpGlyph size={large ? 14 : 12} />}
      <span className="leading-none">{count}</span>
      {burst > 0 ? (
        <span
          key={burst}
          className="qa-float pointer-events-none absolute left-1/2 top-0 text-[11px] font-black"
          style={{ color: QA_ACCENT }}
        >
          +1
        </span>
      ) : null}
    </button>
  );
  if (frozen || !onToggle) return body;
  return (
    <Tooltip
      title={mine ? 'Withdraw your vote' : 'Upvote'}
      description="One vote per person per note. The most voted rise to the top."
    >
      {body}
    </Tooltip>
  );
}

// A small round icon button, for the facilitator's per-row actions.
export function RoundAction({
  label,
  description,
  onPress,
  textColor,
  tone = 'plain',
  children,
}: {
  label: string;
  description: string;
  onPress: () => void;
  textColor: string;
  tone?: 'plain' | 'accent' | 'danger';
  children: React.ReactNode;
}) {
  const press = usePressWithoutDrag(onPress);
  const color = tone === 'accent' ? QA_ACCENT : tone === 'danger' ? '#e11d48' : textColor;
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        {...press}
        {...stopPointer}
        aria-label={label}
        className="pointer-events-auto inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition hover:scale-110"
        style={{ color, backgroundColor: tint(color, 0.12) }}
      >
        {children}
      </button>
    </Tooltip>
  );
}
