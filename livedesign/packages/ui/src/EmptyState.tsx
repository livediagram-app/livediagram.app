// Reusable illustrated empty state (docs/specs/013-workspace/folders.md): a floating gradient icon badge
// over a softly pulsing double ring and a faint mini-diagram motif, with a
// heading, a one-line explainer, and an optional CTA slot (children). CSS-only
// motion (the `animate-empty-*` utilities + keyframes live in the shared
// tailwind theme, paused under prefers-reduced-motion). Shared across apps —
// the live Explorer's document-list + per-feature empty states and the
// telemetry dashboard's no-data states — so they all read alike.
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  children,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  // Inside a narrow pane (the editor's Explorer): the same parts, smaller and without the card frame, so it sits
  // calmly in the pane rather than filling it.
  compact?: boolean;
}) {
  return (
    <div
      data-empty-state={compact ? 'compact' : 'page'}
      className={`relative flex flex-col items-center justify-center overflow-hidden text-center ${
        compact
          ? 'px-4 py-10'
          : 'rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-6 py-16 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/60'
      }`}
    >
      <EmptyStateArt icon={icon} compact={compact} spaced />

      <h2
        className={`relative font-semibold text-slate-900 dark:text-slate-100 ${compact ? 'text-sm' : 'text-base'}`}
      >
        {title}
      </h2>
      <p
        className={`relative mt-1.5 max-w-sm leading-relaxed text-slate-500 dark:text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {description}
      </p>
      {children ? <div className={`relative ${compact ? 'mt-4' : 'mt-5'}`}>{children}</div> : null}
    </div>
  );
}

/** The empty state's art alone: the faint mini-diagram motif behind the floating badge over its pulsing rings. For a
 *  surface that is empty in its own shape with no words to add (an empty folder's card, folders.md "Folder cards"). */
export function EmptyStateArt({
  icon,
  compact = false,
  spaced = false,
}: {
  icon: ReactNode;
  compact?: boolean;
  // Room under the badge for a heading that follows (EmptyState); the art alone sits centred with none.
  spaced?: boolean;
}) {
  return (
    <>
      {/* Faint mini-diagram motif (two shapes + an elbow connector) — the
          product's own visual language as a quiet backdrop. */}
      <svg
        aria-hidden
        width="240"
        height="130"
        viewBox="0 0 240 130"
        fill="none"
        className={`pointer-events-none absolute text-slate-900 opacity-[0.04] dark:text-white ${compact ? 'top-2' : 'top-8'}`}
      >
        <rect x="34" y="34" width="60" height="34" rx="7" fill="currentColor" />
        <rect x="150" y="64" width="60" height="34" rx="7" fill="currentColor" />
        <path d="M94 51 H122 V81 H150" stroke="currentColor" strokeWidth="3" />
      </svg>

      {/* Floating icon badge over a pulsing double ring. */}
      <div
        className={`relative flex items-center justify-center ${compact ? 'h-14 w-14' : 'h-20 w-20'} ${
          spaced ? (compact ? 'mb-4' : 'mb-5') : ''
        }`}
      >
        <span
          aria-hidden
          className={`animate-empty-ring absolute inset-0 bg-brand-400/30 ${compact ? 'rounded-2xl' : 'rounded-3xl'}`}
        />
        <span
          aria-hidden
          className={`animate-empty-ring absolute inset-0 bg-brand-400/20 [animation-delay:1.3s] ${compact ? 'rounded-2xl' : 'rounded-3xl'}`}
        />
        <span
          className={`animate-empty-float relative flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 ${
            compact
              ? 'h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5'
              : 'h-16 w-16 rounded-2xl [&_svg]:h-7 [&_svg]:w-7'
          }`}
        >
          {icon}
        </span>
      </div>
    </>
  );
}
