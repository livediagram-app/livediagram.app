'use client';

// The Facilitate tour's welcome card hero (docs/specs/012-collaboration/facilitate-tour.md "The steps"): a
// flipchart on its easel with two sticky notes landing on the pad in turn, and a timer beside it counting
// down, with the tour's spark motif. The welcome art's recipe (TourWelcomeArt, PlanTourArt): pure inline SVG
// + CSS keyframes, Tailwind fill/stroke classes for light and dark, looping with the `animation` shorthand
// and `infinite`, and still under reduced motion (the global collapse in globals.css, plus its own
// `animation: none`).
export function FacilitateTourArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .facilitate-tour-el { transform-box: fill-box; transform-origin: 50% 50%; }
        @keyframes facilitate-tour-land {
          0%, 12% { opacity: 0; transform: translateY(-10px) rotate(-6deg); }
          24%, 88% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(0) rotate(0deg); }
        }
        @keyframes facilitate-tour-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes facilitate-tour-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .facilitate-tour-note-a { animation: facilitate-tour-land 4.8s ease-out infinite; }
        .facilitate-tour-note-b { animation: facilitate-tour-land 4.8s ease-out 0.6s infinite; }
        .facilitate-tour-hand { transform-origin: 236px 52px; animation: facilitate-tour-sweep 4.8s linear infinite; }
        .facilitate-tour-spark { animation: facilitate-tour-twinkle 2.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .facilitate-tour-note-a, .facilitate-tour-note-b, .facilitate-tour-hand, .facilitate-tour-spark { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* The easel's legs, behind the pad. */}
        <path
          d="M104 84 L118 96 M200 84 L186 96 M152 84 L152 98"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-slate-300 dark:stroke-slate-500"
        />
        {/* The flipchart pad, with its binding along the top. */}
        <rect
          x="96"
          y="10"
          width="112"
          height="76"
          rx="5"
          className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
          strokeWidth="1.5"
        />
        <rect x="96" y="10" width="112" height="7" rx="3" className="fill-brand-500" />
        {/* A heading line on the pad. */}
        <rect
          x="108"
          y="26"
          width="44"
          height="4"
          rx="2"
          className="fill-slate-300 dark:fill-slate-500"
        />
        {/* The two sticky notes, landing in turn. */}
        <g className="facilitate-tour-el facilitate-tour-note-a">
          <rect
            x="108"
            y="40"
            width="36"
            height="34"
            rx="3"
            className="fill-amber-300 dark:fill-amber-400"
          />
          <rect x="114" y="48" width="22" height="3" rx="1.5" className="fill-amber-600/60" />
          <rect x="114" y="55" width="16" height="3" rx="1.5" className="fill-amber-600/60" />
        </g>
        <g className="facilitate-tour-el facilitate-tour-note-b">
          <rect
            x="156"
            y="40"
            width="36"
            height="34"
            rx="3"
            className="fill-sky-300 dark:fill-sky-400"
          />
          <rect x="162" y="48" width="22" height="3" rx="1.5" className="fill-sky-700/50" />
          <rect x="162" y="55" width="18" height="3" rx="1.5" className="fill-sky-700/50" />
        </g>
        {/* The timer beside the easel: a face and a sweeping hand. */}
        <circle
          cx="236"
          cy="52"
          r="18"
          className="fill-white stroke-brand-400 dark:fill-slate-700 dark:stroke-brand-300"
          strokeWidth="2.5"
        />
        <rect
          x="232"
          y="28"
          width="8"
          height="4"
          rx="1.5"
          className="fill-brand-400 dark:fill-brand-300"
        />
        <path
          d="M236 52 L236 40"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="facilitate-tour-hand stroke-slate-500 dark:stroke-slate-300"
        />
        <circle cx="236" cy="52" r="2.5" className="fill-slate-500 dark:fill-slate-300" />
        {/* The tour's spark motif. */}
        <path
          d="M64 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"
          className="facilitate-tour-el facilitate-tour-spark fill-brand-400 dark:fill-brand-300"
        />
      </svg>
    </div>
  );
}
