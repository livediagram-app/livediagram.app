// The Q&A board's small parts (docs/specs/012-collaboration/qa-board.md): its glyphs, the author chip, the
// vote pill and the relative-time label. Shared by the spotlight, the queue
// rows and the Discussed drawer so the three read as one object.

import { useEffect, useRef, useState } from 'react';
import type { QaNote } from '@livediagram/diagram';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { HoverCard, Glyph, GlyphDisc } from '@livediagram/ui';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';

// The board's accent marks what is YOURS and what is LIVE. It is the tab
// theme's colour, not the board's own: QaBoardFace sets `--qa-accent` from the
// element's themed stroke, and `--qa-on-accent` to whichever ink reads on it,
// so a warm theme gets a warm board and a pale accent never carries white
// text. Everything here reads the variables (tint() mixes them via
// color-mix), so there is one place the colour is decided.
export const QA_ACCENT = 'var(--qa-accent)';
export const QA_ON_ACCENT = 'var(--qa-on-accent)';
// The accent as TEXT on the card. A theme's accent can sit on the same side of
// light as its card (a pale yellow stroke on cream), where it fills a button
// fine but vanishes as a word, so labels and glyphs read this instead: the
// accent where it contrasts, pulled toward the theme's ink where it doesn't.
export const QA_ACCENT_INK = 'var(--qa-accent-ink)';

// Every control on the board stops the pointer at itself: a press on a vote
// must not also select the board, which would put your name on it through the
// docs/specs/007-editor/live-app.md selection ring at the moment you vote (the Idea box's reasoning,
// docs/specs/012-collaboration/idea-box.md) and take the lock away from whoever is holding it.
export const stopPointer = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

type Glyph = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <Glyph size={size} units={16}>
    {children}
  </Glyph>
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

// Who wrote it: an initial in their colour, or the mask. The Idea box's cards
// always take the mask (they have nowhere to store an author).
export function AuthorChip({
  author,
  textColor,
  size = 16,
}: {
  author: QaNote['author'];
  textColor: string;
  size?: number;
}) {
  if (!author) {
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
  const initial = author.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="inline-flex min-w-0 items-center gap-1" style={{ color: textColor }}>
      <GlyphDisc
        size={size}
        className={`font-bold text-white ${IDENTITY_FILL}`}
        style={{ ...identityVars(author.color), fontSize: size * 0.55 }}
      >
        {initial}
      </GlyphDisc>
      <span className="truncate opacity-70">{author.name}</span>
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
        color: mine ? QA_ON_ACCENT : textColor,
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
          style={{ color: QA_ACCENT_INK }}
        >
          +1
        </span>
      ) : null}
    </button>
  );
  if (frozen || !onToggle) return body;
  return (
    <HoverCard
      title={mine ? 'Withdraw your vote' : 'Upvote'}
      description="One vote per person per note. The most voted rise to the top."
    >
      {body}
    </HoverCard>
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
  const color = tone === 'accent' ? QA_ACCENT_INK : tone === 'danger' ? '#e11d48' : textColor;
  return (
    <HoverCard title={label} description={description}>
      <GlyphDisc
        size={24}
        as="button"
        type="button"
        {...press}
        {...stopPointer}
        aria-label={label}
        className="pointer-events-auto cursor-pointer transition hover:scale-110"
        style={{ color, backgroundColor: tint(color, 0.12) }}
      >
        {children}
      </GlyphDisc>
    </HoverCard>
  );
}

// The one facilitator action a board offers above its rows, as a dashed bar
// in the accent: the Q&A board's "Discuss the top note", the Idea box's "Open
// the box" and "Scatter to sticky notes" (docs/specs/012-collaboration/idea-box.md "The look").
export function AccentBar({
  onPress,
  icon,
  hoverCard,
  children,
}: {
  onPress: () => void;
  icon?: React.ReactNode;
  hoverCard?: { title: string; description: string };
  children: React.ReactNode;
}) {
  const press = usePressWithoutDrag(onPress);
  const bar = (
    <button
      type="button"
      {...press}
      {...stopPointer}
      className="pointer-events-auto flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-[11px] font-semibold transition hover:brightness-110"
      style={{
        color: QA_ACCENT_INK,
        borderColor: tint(QA_ACCENT, 0.45),
        backgroundColor: tint(QA_ACCENT, 0.05),
      }}
    >
      {icon}
      {children}
    </button>
  );
  return hoverCard ? (
    <HoverCard title={hoverCard.title} description={hoverCard.description}>
      {bar}
    </HoverCard>
  ) : (
    bar
  );
}

// A padlock: the Idea box's sealed state.
export const LockGlyph = ({ size = 12 }: Glyph) =>
  svg(
    size,
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>,
  );

// An open eye: reveal.
export const EyeGlyph = ({ size = 12 }: Glyph) =>
  svg(
    size,
    <>
      <path d="M1.8 8S4.2 3.8 8 3.8 14.2 8 14.2 8 11.8 12.2 8 12.2 1.8 8 1.8 8Z" />
      <circle cx="8" cy="8" r="1.8" />
    </>,
  );

// Scatter: three small cards fanning out.
export const ScatterGlyph = ({ size = 12 }: Glyph) =>
  svg(
    size,
    <>
      <rect x="2" y="6" width="5" height="5" rx="1" />
      <rect x="9" y="3" width="5" height="5" rx="1" />
      <rect x="8" y="10" width="4" height="4" rx="1" />
    </>,
  );

// An empty board: faint rows that breathe (qa-ghost), so it reads as waiting,
// not broken, and below them, spaced off the rows, a small invitation: a
// sparkle in the accent, a title, and the hint in softer ink kept to a
// readable measure. The Q&A board's and the Idea box's empty state.
export function EmptyRows({
  textColor,
  title,
  children,
}: {
  textColor: string;
  title: string;
  // The hint under the title; absent for a viewer who can't add.
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 pb-2 pt-1">
      <div className="flex w-full flex-col gap-1.5" aria-hidden>
        {[0.92, 0.7, 0.8].map((w, i) => (
          <div
            key={i}
            className="qa-ghost flex items-center gap-2 rounded-xl p-2"
            style={{ backgroundColor: tint(textColor, 0.04), animationDelay: `${i * 300}ms` }}
          >
            <span
              className="h-8 w-8 rounded-lg"
              style={{ backgroundColor: tint(textColor, 0.08) }}
            />
            <span
              className="h-2 rounded-full"
              style={{ width: `${w * 70}%`, backgroundColor: tint(textColor, 0.1) }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <GlyphDisc
          size={28}
          style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }}
        >
          <SparkGlyph size={14} />
        </GlyphDisc>
        <p className="mt-1 text-[12.5px] font-semibold leading-tight" style={{ color: textColor }}>
          {title}
        </p>
        {children ? (
          <p
            className="max-w-[30ch] text-[11px] leading-relaxed"
            style={{ color: textColor, opacity: 0.55 }}
          >
            {children}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// A four-point sparkle: something new is wanted here.
export const SparkGlyph = ({ size = 12 }: Glyph) =>
  svg(
    size,
    <>
      <path d="M8 2.2 9.3 6.7 13.8 8 9.3 9.3 8 13.8 6.7 9.3 2.2 8 6.7 6.7Z" />
      <path d="M12.6 2.4v2.4M11.4 3.6h2.4" />
    </>,
  );
