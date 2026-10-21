// The Collaborate cards' small parts (docs/specs/012-collaboration/comment-pin.md, action-panel.md): the accent
// they paint with, their glyphs, the dashed accent bar and the empty state. Shared by the Comment and Action
// panels, the composer and the temperature check so they read as one family.

import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from './collab-chrome';
import { Glyph, GlyphDisc } from '@liveplanner/ui';

// A card's accent marks what is YOURS and what is LIVE. It is the tab theme's colour, not the card's own:
// CollabAccentScope sets `--collab-accent` from the element's themed stroke, and `--collab-on-accent` to whichever
// ink reads on it, so a warm theme gets a warm card and a pale accent never carries white text. Everything here
// reads the variables (tint() mixes them via color-mix), so there is one place the colour is decided.
export const COLLAB_ACCENT = 'var(--collab-accent)';
export const COLLAB_ON_ACCENT = 'var(--collab-on-accent)';
// The accent as TEXT on the card. A theme's accent can sit on the same side of light as its card (a pale yellow
// stroke on cream), where it fills a button fine but vanishes as a word, so labels and glyphs read this instead:
// the accent where it contrasts, pulled toward the theme's ink where it doesn't.
export const COLLAB_ACCENT_INK = 'var(--collab-accent-ink)';

// The one LOUD act on a card, filled in the accent with a soft glow under it: the Action panel's "Add Action".
export const LOUD_ACCENT = {
  color: COLLAB_ON_ACCENT,
  backgroundColor: COLLAB_ACCENT,
  boxShadow: `0 8px 16px -10px ${COLLAB_ACCENT}`,
} as const;

// Every control on a card stops the pointer at itself: a press must not also select the card, which would put
// your name on it through the docs/specs/007-editor/live-app.md selection ring at the moment you answer and take
// the lock away from whoever is holding it.
export const stopPointer = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

type GlyphProps = { size?: number };
const svg = (size: number, children: React.ReactNode) => (
  <Glyph size={size} units={16}>
    {children}
  </Glyph>
);
export const CheckGlyph = ({ size = 12 }: GlyphProps) => svg(size, <path d="m3.5 8.5 3 3 6-7" />);
export const ReopenGlyph = ({ size = 12 }: GlyphProps) =>
  svg(size, <path d="M4 6.5A4.5 4.5 0 1 1 3.5 10M4 3v3.5h3.5" />);
export const SendGlyph = ({ size = 12 }: GlyphProps) =>
  svg(size, <path d="M8 13V3.5M3.8 7.5 8 3.3l4.2 4.2" />);
// A speech bubble with a typing ellipsis: a conversation.
export const DiscussGlyph = ({ size = 12 }: GlyphProps) =>
  svg(
    size,
    <>
      <path d="M3 2.8h10a1.2 1.2 0 0 1 1.2 1.2v6.2a1.2 1.2 0 0 1-1.2 1.2H7.4L4.2 14v-2.6H3a1.2 1.2 0 0 1-1.2-1.2V4A1.2 1.2 0 0 1 3 2.8Z" />
      <circle cx="5.4" cy="7.1" r=".85" fill="currentColor" stroke="none" />
      <circle cx="8" cy="7.1" r=".85" fill="currentColor" stroke="none" />
      <circle cx="10.6" cy="7.1" r=".85" fill="currentColor" stroke="none" />
    </>,
  );

// The one action a card offers above its rows, as a dashed bar in the accent: the Comment panel's "Reopen
// Thread", the Action panel's "Add Action".
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

// An empty card: faint rows that breathe (collab-ghost), so it reads as waiting, not broken, and below them,
// spaced off the rows, a small invitation: a sparkle in the accent, a title, and the hint in softer ink kept to a
// readable measure.
export function EmptyRows({
  textColor,
  title,
  rows = 3,
  glyph,
  children,
}: {
  textColor: string;
  title: string;
  // The card's own glyph in the disc; the sparkle ("something new is wanted here") when absent.
  glyph?: React.ReactNode;
  // How many breathing rows to draw above the invitation; 0 for a card too small for them.
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
const SparkGlyph = ({ size = 12 }: GlyphProps) =>
  svg(
    size,
    <>
      <path d="M8 2.2 9.3 6.7 13.8 8 9.3 9.3 8 13.8 6.7 9.3 2.2 8 6.7 6.7Z" />
      <path d="M12.6 2.4v2.4M11.4 3.6h2.4" />
    </>,
  );
