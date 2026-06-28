// Reusable illustrated empty state (spec/15): a floating gradient icon badge
// over a softly pulsing double ring and a faint mini-diagram motif, with a
// heading, a one-line explainer, and an optional CTA slot (children). CSS-only
// motion (the `animate-empty-*` utilities + keyframes live in the shared
// tailwind theme, paused under prefers-reduced-motion). Shared across apps —
// the live Explorer's diagram-list + per-feature empty states and the
// telemetry dashboard's no-data states — so they all read alike.
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 px-6 py-16 text-center dark:border-slate-700 dark:from-slate-900 dark:to-slate-900/60">
      {/* Faint mini-diagram motif (two shapes + an elbow connector) — the
          product's own visual language as a quiet backdrop. */}
      <svg
        aria-hidden
        width="240"
        height="130"
        viewBox="0 0 240 130"
        fill="none"
        className="pointer-events-none absolute top-8 text-slate-900 opacity-[0.04] dark:text-white"
      >
        <rect x="34" y="34" width="60" height="34" rx="7" fill="currentColor" />
        <rect x="150" y="64" width="60" height="34" rx="7" fill="currentColor" />
        <path d="M94 51 H122 V81 H150" stroke="currentColor" strokeWidth="3" />
      </svg>

      {/* Floating icon badge over a pulsing double ring. */}
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
        <span
          aria-hidden
          className="animate-empty-ring absolute inset-0 rounded-3xl bg-brand-400/30"
        />
        <span
          aria-hidden
          className="animate-empty-ring absolute inset-0 rounded-3xl bg-brand-400/20 [animation-delay:1.3s]"
        />
        <span className="animate-empty-float relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </span>
      </div>

      <h2 className="relative text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <p className="relative mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {children ? <div className="relative mt-5">{children}</div> : null}
    </div>
  );
}
