// The Collaborate cards' small parts (docs/specs/012-collaboration/comment-pin.md, action-panel.md, idea-box.md
// and the rest of the family): the accent they paint with, their glyphs, the anonymous author chip, the dashed
// accent bar and the empty state. Shared so the cards read as one family.

import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from './collab-chrome';
import { Glyph, GlyphDisc } from '@livepages/ui';

// A card's accent marks what is YOURS and what is LIVE. It is the tab
// theme's colour, not the card's own: CollabAccentScope sets `--collab-accent` from the
// element's themed stroke, and `--collab-on-accent` to whichever ink reads on it,
// so a warm theme gets a warm card and a pale accent never carries white
// text. Everything here reads the variables (tint() mixes them via
// color-mix), so there is one place the colour is decided.
export const COLLAB_ACCENT = 'var(--collab-accent)';
export const COLLAB_ON_ACCENT = 'var(--collab-on-accent)';
// The accent as TEXT on the card. A theme's accent can sit on the same side of
// light as its card (a pale yellow stroke on cream), where it fills a button
// fine but vanishes as a word, so labels and glyphs read this instead: the
// accent where it contrasts, pulled toward the theme's ink where it doesn't.
export const COLLAB_ACCENT_INK = 'var(--collab-accent-ink)';

// The one LOUD act on a card, filled in the accent with a soft glow under it:
// the Done check's "I'm done", the Action panel's "Add Action".
export const LOUD_ACCENT = {
  color: COLLAB_ON_ACCENT,
  backgroundColor: COLLAB_ACCENT,
  boxShadow: `0 8px 16px -10px ${COLLAB_ACCENT}`,
} as const;

// Every control on a card stops the pointer at itself: a press on a control
// must not also select the card, which would put your name on it through the
// docs/specs/007-editor/live-app.md selection ring at the moment you answer (the Idea box's reasoning,
// docs/specs/012-collaboration/idea-box.md) and take the lock away from whoever is holding it.
export const stopPointer = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

type Glyph = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <Glyph size={size} units={16}>
    {children}
  </Glyph>
);
export const CheckGlyph = ({ size = 12 }: Glyph) => svg(size, <path d="m3.5 8.5 3 3 6-7" />);
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
// A speech bubble with a typing ellipsis: a conversation.
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

// An anonymous author: the mask in a soft disc, and "Anonymous". The Idea box's cards always wear it (they have
// nowhere to store an author).
export function AnonymousChip({ textColor, size = 16 }: { textColor: string; size?: number }) {
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

// The one facilitator action a card offers above its rows, as a dashed bar
// in the accent: the Idea box's "Open the Box" and "Scatter to Sticky Notes"
// (docs/specs/012-collaboration/idea-box.md "The look"), the Comment panel's and the Action panel's.
export function AccentBar({
  onPress,
  icon,
  count,
  children,
}: {
  onPress: () => void;
  icon?: React.ReactNode;
  // How many things the action covers, as a badge in the accent
  // (docs/specs/004-interface-design/counts.md), never "(3)" in the label.
  count?: number;
  children: React.ReactNode;
}) {
  const press = usePressWithoutDrag(onPress);
  // No hover card: the bar's label is the whole story.
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      className="pointer-events-auto flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-[11px] font-semibold transition hover:brightness-110"
      style={{
        color: COLLAB_ACCENT_INK,
        borderColor: tint(COLLAB_ACCENT, 0.45),
        backgroundColor: tint(COLLAB_ACCENT, 0.05),
      }}
    >
      {icon}
      {children}
      {count !== undefined ? (
        <span
          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ color: COLLAB_ON_ACCENT, backgroundColor: COLLAB_ACCENT }}
        >
          <span className="text-optical-centre">{count}</span>
        </span>
      ) : null}
    </button>
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

// An empty card: faint rows that breathe (collab-ghost), so it reads as waiting,
// not broken, and below them, spaced off the rows, a small invitation: a
// sparkle in the accent, a title, and the hint in softer ink kept to a
// readable measure. The Idea box's empty state, and the other cards'.
export function EmptyRows({
  textColor,
  title,
  rows = 3,
  glyph,
  children,
}: {
  textColor: string;
  title: string;
  // The card's own glyph in the disc; the sparkle ("something new is wanted
  // here") when absent.
  glyph?: React.ReactNode;
  // How many breathing rows to draw above the invitation; 0 for a card too
  // small for them (the fixed-size Done check).
  rows?: number;
  // The hint under the title; absent for a viewer who can't add.
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 pb-2 pt-1">
      {rows > 0 ? (
        <div className="flex w-full flex-col gap-1.5" aria-hidden>
          {[0.92, 0.7, 0.8].slice(0, rows).map((w, i) => (
            <div
              key={i}
              className="collab-ghost flex items-center gap-2 rounded-xl p-2"
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
      ) : null}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <GlyphDisc
          size={28}
          style={{ color: COLLAB_ACCENT_INK, backgroundColor: tint(COLLAB_ACCENT, 0.14) }}
        >
          {glyph ?? <SparkGlyph size={14} />}
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
