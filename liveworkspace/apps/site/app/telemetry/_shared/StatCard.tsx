import type { ReactNode } from 'react';

// The dashboard's card (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): what it counts at
// the top left (an icon tile in the card's hue, a title and a line under it), the number and its trend arrow at
// the top right, a sentence saying what it means, then its chart pinned to the bottom. A metric's card
// (MetricCard) and All Apps' cards are both this, so every number on the page reads the same way.
export function StatCard({
  icon,
  color,
  title,
  subtitle,
  aside,
  blurb,
  children,
  footer,
}: {
  // The glyph in the tile, tinted with `color` (a hex). Left out when the title is a logo.
  icon?: ReactNode;
  color?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  // The trend arrow and the number.
  aside: ReactNode;
  blurb?: ReactNode;
  // The chart.
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    // `flex h-full flex-col` + `mt-auto` on the chart pins every trend line to
    // the bottom of the card. Grid rows already stretch cards to equal height,
    // so without this a longer blurb (e.g. an aggregate's) would push its chart
    // down and misalign it with the shorter cards beside it in the same row.
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && color ? (
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
            {subtitle ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{aside}</div>
      </div>
      {blurb ? (
        <div className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {blurb}
        </div>
      ) : null}
      {children ? <div className="mt-auto pt-4">{children}</div> : null}
      {footer}
    </div>
  );
}

/** The card's number, at the size every card shows it. */
export function StatValue({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{children}</span>
  );
}
