'use client';

// The Plan tour's welcome card hero (docs/specs/026-plan/plan-tour.md "The steps"): a small board of three
// columns, one card sliding from the first column to the second and settling, as work moves along, with
// the tour's spark motif. The welcome art's recipe (TourWelcomeArt): pure inline SVG + CSS keyframes,
// Tailwind fill/stroke classes for light and dark, looping with the `animation` shorthand and `infinite`,
// and still under reduced motion (the global collapse in globals.css, plus its own `animation: none`).
const COLUMNS = [44, 124, 204];

export function PlanTourArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .plan-tour-el { transform-box: fill-box; transform-origin: 50% 50%; }
        @keyframes plan-tour-move {
          0%, 18% { transform: translate(0px, 0px); }
          30% { transform: translate(40px, -6px) rotate(3deg); }
          44%, 86% { transform: translate(80px, 0px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes plan-tour-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .plan-tour-card { animation: plan-tour-move 4.6s ease-in-out infinite; }
        .plan-tour-spark { animation: plan-tour-twinkle 2.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .plan-tour-card, .plan-tour-spark { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* The board's columns, each with its header bar. */}
        {COLUMNS.map((x, i) => (
          <g key={x}>
            <rect
              x={x}
              y="14"
              width="68"
              height="78"
              rx="6"
              className="fill-slate-100 dark:fill-slate-700/40"
            />
            <rect
              x={x + 8}
              y="21"
              width={i === 1 ? 30 : 24}
              height="4"
              rx="2"
              className="fill-slate-300 dark:fill-slate-500"
            />
          </g>
        ))}
        {/* Cards that stay put. */}
        <rect
          x="52"
          y="58"
          width="52"
          height="18"
          rx="3"
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        />
        <rect
          x="132"
          y="58"
          width="52"
          height="18"
          rx="3"
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        />
        <rect
          x="212"
          y="32"
          width="52"
          height="18"
          rx="3"
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
        />
        {/* The card moving along, with its type's stripe. */}
        <g className="plan-tour-el plan-tour-card">
          <rect
            x="52"
            y="32"
            width="52"
            height="18"
            rx="3"
            className="fill-brand-50 stroke-brand-500 dark:fill-brand-500/20 dark:stroke-brand-400"
            strokeWidth="1.5"
          />
          <rect x="52" y="32" width="3" height="18" rx="1.5" className="fill-brand-500" />
        </g>
        {/* The tour's spark. */}
        <path
          d="M 284 18 c 1.1 5.5 3.2 7.6 8.7 8.7 -5.5 1.1 -7.6 3.2 -8.7 8.7 -1.1 -5.5 -3.2 -7.6 -8.7 -8.7 5.5 -1.1 7.6 -3.2 8.7 -8.7 Z"
          className="plan-tour-el plan-tour-spark fill-brand-400 dark:fill-brand-300"
        />
      </svg>
    </div>
  );
}
