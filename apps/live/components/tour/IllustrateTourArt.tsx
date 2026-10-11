'use client';

// The Illustrate tour's welcome card hero (docs/specs/007-editor/illustrate-tour.md "The steps"): an A4 page whose
// layout fills in (a colour band, a headline, a bar chart growing) beside a widescreen slide, with the tour's spark
// motif. The welcome art's recipe (TourWelcomeArt, DrawTourArt): pure inline SVG + CSS keyframes, Tailwind
// fill/stroke classes for light and dark, looping with the `animation` shorthand and `infinite`, and still under
// reduced motion (the global collapse in globals.css, plus its own `animation: none`).
export function IllustrateTourArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .illustrate-tour-el { transform-box: fill-box; transform-origin: 50% 100%; }
        @keyframes illustrate-tour-in {
          0%, 10% { opacity: 0; transform: translateY(4px); }
          24%, 88% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(0); }
        }
        @keyframes illustrate-tour-grow {
          0%, 24% { transform: scaleY(0); }
          44%, 88% { transform: scaleY(1); }
          100% { transform: scaleY(1); opacity: 0; }
        }
        @keyframes illustrate-tour-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .illustrate-tour-band { animation: illustrate-tour-in 4.8s ease-out infinite; }
        .illustrate-tour-head { animation: illustrate-tour-in 4.8s ease-out 0.3s infinite; }
        .illustrate-tour-bar { animation: illustrate-tour-grow 4.8s ease-out infinite; }
        .illustrate-tour-slide { animation: illustrate-tour-in 4.8s ease-out 0.8s infinite; }
        .illustrate-tour-spark { transform-origin: 50% 50%; animation: illustrate-tour-twinkle 2.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .illustrate-tour-band, .illustrate-tour-head, .illustrate-tour-bar, .illustrate-tour-slide, .illustrate-tour-spark { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* The A4 page. */}
        <rect
          x="84"
          y="8"
          width="64"
          height="88"
          rx="3"
          className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
          strokeWidth="1.5"
        />
        <rect
          x="84"
          y="8"
          width="64"
          height="16"
          rx="3"
          className="illustrate-tour-el illustrate-tour-band fill-brand-500"
        />
        <g className="illustrate-tour-el illustrate-tour-head">
          <rect
            x="92"
            y="32"
            width="40"
            height="5"
            rx="2"
            className="fill-slate-700 dark:fill-slate-200"
          />
          <rect
            x="92"
            y="41"
            width="28"
            height="3"
            rx="1.5"
            className="fill-slate-300 dark:fill-slate-500"
          />
        </g>
        {/* Its bar chart, growing from the axis. */}
        <path
          d="M92 86 H140"
          strokeWidth="1.5"
          className="stroke-slate-300 dark:stroke-slate-500"
        />
        <rect
          x="96"
          y="66"
          width="8"
          height="20"
          rx="1"
          className="illustrate-tour-el illustrate-tour-bar fill-sky-400"
        />
        <rect
          x="110"
          y="56"
          width="8"
          height="30"
          rx="1"
          className="illustrate-tour-el illustrate-tour-bar fill-brand-400"
        />
        <rect
          x="124"
          y="62"
          width="8"
          height="24"
          rx="1"
          className="illustrate-tour-el illustrate-tour-bar fill-rose-400"
        />
        {/* A widescreen slide beside it. */}
        <g className="illustrate-tour-el illustrate-tour-slide">
          <rect
            x="164"
            y="30"
            width="76"
            height="44"
            rx="3"
            className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
            strokeWidth="1.5"
          />
          <rect
            x="172"
            y="40"
            width="36"
            height="5"
            rx="2"
            className="fill-slate-700 dark:fill-slate-200"
          />
          <rect x="172" y="49" width="20" height="2" rx="1" className="fill-brand-500" />
          <rect
            x="172"
            y="56"
            width="28"
            height="3"
            rx="1.5"
            className="fill-slate-300 dark:fill-slate-500"
          />
          <rect
            x="172"
            y="62"
            width="22"
            height="3"
            rx="1.5"
            className="fill-slate-300 dark:fill-slate-500"
          />
          <rect
            x="214"
            y="40"
            width="18"
            height="26"
            rx="2"
            className="fill-amber-300 dark:fill-amber-400"
          />
        </g>
        {/* The tour's spark motif. */}
        <path
          d="M52 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"
          className="illustrate-tour-el illustrate-tour-spark fill-brand-400 dark:fill-brand-300"
        />
      </svg>
    </div>
  );
}
