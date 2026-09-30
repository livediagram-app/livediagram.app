import type { ReactNode } from 'react';

// The selectable tile the palette's pickers are built from: a preview area
// over a label and description, click to select and double-click to commit.
//
// Four cards were written out longhand — a template, a template category, a
// theme, a theme category — each repeating the same button, the same
// active/inactive class pair, and the same caption block. The two category
// cards also repeated the count badge, comment included.
//
// The preview arrives as children because that is the part each card exists
// to show, and it is genuinely different every time: a mini-canvas SVG, a
// 2x2 theme sampler, a grid of preview tiles.
export function PickerCard({
  active,
  onSelect,
  onCommit,
  ariaLabel,
  label,
  description,
  count,
  className = '',
  clampDescription = true,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  // Double-click commits, so a decisive user skips the footer button. The
  // category cards omit it: their click already opens the category, and
  // wiring the same callback here would fire it a third time on a
  // double-click rather than the two the two clicks already cause.
  onCommit?: () => void;
  // Category cards label the action ("Browse Cool themes") because their
  // visible text names the category, not what pressing it does.
  ariaLabel?: string;
  label: string;
  description: string;
  // Category cards only: how many things are inside. Omitted on the cards
  // that ARE the thing rather than a way in to more of them.
  count?: number;
  // Extra layout classes, e.g. h-full w-full so carousel cards share a height.
  className?: string;
  // Two lines is plenty for a theme or category blurb; a template's description is what it
  // is picked by, so template cards show it whole (false).
  clampDescription?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onCommit}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`${
        // min-w-0 on the button itself: grid items default to min-width:auto,
        // which lets a long unbroken label push the card wider than its track.
        active
          ? 'preview-motion-host flex min-w-0 flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
          : 'preview-motion-host flex min-w-0 flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      } ${className}`}
    >
      {children}
      {/* w-full is what bounds the caption: the button is a column flex with
          items-start, so a block left to size itself takes its max-content
          width and a long title ("Horizontal milestone timeline") ran straight
          out of the card. Bounded, the label wraps to at most two lines rather
          than truncating: the name is what the card is picked by, so clipping
          it to "Horizontal milestone timeli…" costs more than the extra row of
          text, and grid rows stretch to a shared height either way. */}
      <div className="w-full min-w-0">
        {count === undefined ? (
          <p className="line-clamp-2 break-words text-xs font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <p className="line-clamp-2 min-w-0 break-words text-xs font-semibold text-slate-900 dark:text-slate-100">
              {label}
            </p>
            {/* Count badge, pinned far right (w-full row + justify-between) so it
                sits in the same spot on every card regardless of label length.

                `top-[0.5px]`: Chromium snaps a text baseline to a whole pixel,
                and in a 14px badge the baseline that would centre a 10px
                figure falls exactly on a half pixel, so every count sat half a
                pixel off whichever way it snapped, right at the optical
                audit's tolerance (docs/specs/004-interface-design/optical-alignment.md). Moving the
                badge half a pixel puts that baseline on the grid. */}
            <span className="inline-flex h-3.5 shrink-0 items-center justify-center relative top-[0.5px] rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold leading-none text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              <span className="text-optical-centre">{count}</span>
            </span>
          </div>
        )}
        {/* A whole-pixel line height (leading-snug made 15.125px), so card
            rows stay on whole pixels and the count badge's half-pixel fix
            above holds on every row, not just the first. */}
        <p
          className={`mt-0.5 text-[11px] leading-[15px] text-slate-500 dark:text-slate-300 ${clampDescription ? 'line-clamp-2' : ''}`}
        >
          {description}
        </p>
      </div>
    </button>
  );
}
