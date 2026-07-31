// Shared chrome for the collaboration panels (spec/123 to spec/129): the card
// title, the small press targets, and the empty-state line.
//
// Five faces render the same card — a title over a body over a control row —
// so the frame lives here once. Without it each face re-types the same four
// class strings and they drift the first time one is tweaked.

import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { Tooltip } from '@/components/primitives/Tooltip';

export function CollabPanel({
  title,
  textColor,
  aside,
  children,
  footer,
}: {
  // The element's own label — the question, the prompt, the session name.
  title: string;
  textColor: string;
  // Small right-aligned status beside the title ("4 of 6 in", "1h 5m").
  aside?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-1.5 px-3 py-2.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span
          className="min-w-0 truncate text-[12px] font-semibold leading-tight"
          style={{ color: textColor }}
        >
          {title.trim()}
        </span>
        {aside ? (
          <span
            className="shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] opacity-55"
            style={{ color: textColor }}
          >
            {aside}
          </span>
        ) : null}
      </div>
      {/* The body scrolls rather than overflowing the element box: a card with
          twelve agenda rows on it is a normal card, and clipping the last few
          with no way to reach them is the bug that would report. */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="flex shrink-0 flex-wrap gap-1.5">{footer}</div> : null}
    </div>
  );
}

// A small pill button. `tone` picks the weight: 'quiet' for the secondary act
// (Clear, Stand), 'loud' for the one the card is for (Reveal, Take roll).
export function CollabButton({
  children,
  onPress,
  disabled,
  tone = 'quiet',
  textColor,
  label,
  tooltip,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'quiet' | 'loud';
  textColor: string;
  // Accessible name where the visible text is a glyph or too terse.
  label?: string;
  tooltip?: { title: string; description: string };
}) {
  // The canvas-wide press guard: a press that turns into a drag moves the
  // element instead of firing (every other on-canvas control uses it).
  const press = usePressWithoutDrag(() => onPress?.());
  const button = (
    <button
      type="button"
      {...press}
      disabled={disabled || !onPress}
      aria-label={label}
      className={`pointer-events-auto cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-default disabled:opacity-45 ${
        tone === 'loud'
          ? 'bg-black/[0.12] hover:bg-black/[0.18] dark:bg-white/15 dark:hover:bg-white/25'
          : 'bg-black/[0.06] hover:bg-black/[0.1] dark:bg-white/10 dark:hover:bg-white/15'
      }`}
      style={{ color: textColor }}
    >
      {children}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip title={tooltip.title} description={tooltip.description}>
      {button}
    </Tooltip>
  );
}

// One value in a row of pickable options (an estimate chip, a 1-5 reading).
// `mine` is the raised state: your own answer, which you can always see even
// when everybody else's is hidden.
export function CollabChip({
  value,
  mine,
  onPress,
  disabled,
  textColor,
}: {
  value: string;
  mine: boolean;
  onPress?: () => void;
  disabled?: boolean;
  textColor: string;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  return (
    <button
      type="button"
      {...press}
      disabled={disabled || !onPress}
      aria-pressed={mine}
      aria-label={`Choose ${value}`}
      className={`pointer-events-auto min-w-[28px] cursor-pointer rounded-md border px-1.5 py-1 text-[12px] font-semibold tabular-nums transition disabled:cursor-default disabled:opacity-45 ${
        mine
          ? 'border-transparent bg-black/[0.16] dark:bg-white/25'
          : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.08] dark:border-white/15 dark:bg-white/[0.06] dark:hover:bg-white/15'
      }`}
      style={{ color: textColor }}
    >
      {value}
    </button>
  );
}

// The line a card shows before anything has happened to it. Deliberately a
// sentence rather than a zero: an average of 0 on an unanswered temperature
// check reads as a very unhappy room (spec/124).
export function CollabEmpty({ children, textColor }: { children: string; textColor: string }) {
  return (
    <p className="py-2 text-[11px] leading-snug opacity-55" style={{ color: textColor }}>
      {children}
    </p>
  );
}
