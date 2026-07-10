'use client';

// The welcome card's animated hero (spec/79): a miniature canvas scene that
// acts out the product in one loop — a square pops in, an arrow draws
// itself across to a circle, the circle lands, a sticky-diamond floats and
// a spark twinkles. Pure inline SVG + CSS keyframes (no runtime), themed
// with Tailwind fill/stroke classes so it follows light/dark, and covered
// by the global reduced-motion collapse in globals.css (both the OS
// preference and the Settings toggle), so motion-sensitive users get the
// final composed scene as a static image.
export function TourWelcomeArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .tour-art-el { transform-box: fill-box; transform-origin: 50% 50%; }
        @keyframes tour-art-pop-a {
          0% { opacity: 0; transform: scale(0); }
          6% { opacity: 1; transform: scale(1.08); }
          9%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; transform: scale(1); }
        }
        @keyframes tour-art-draw {
          0%, 16% { stroke-dashoffset: 1; opacity: 1; }
          44%, 90% { stroke-dashoffset: 0; opacity: 1; }
          97%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes tour-art-pop-b {
          0%, 42% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.12); }
          54%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; transform: scale(1); }
        }
        @keyframes tour-art-head {
          0%, 43% { opacity: 0; }
          50%, 90% { opacity: 1; }
          97%, 100% { opacity: 0; }
        }
        @keyframes tour-art-bob {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }
        @keyframes tour-art-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .tour-art-square { animation: tour-art-pop-a 4.6s ease-out infinite; }
        .tour-art-arrow { animation: tour-art-draw 4.6s ease-in-out infinite; }
        .tour-art-circle { animation: tour-art-pop-b 4.6s ease-out infinite; }
        .tour-art-arrowhead { animation: tour-art-head 4.6s ease-out infinite; }
        .tour-art-diamond { animation: tour-art-bob 2.6s ease-in-out infinite alternate; }
        .tour-art-spark { animation: tour-art-twinkle 2.3s ease-in-out infinite; }
        .tour-art-spark-2 { animation: tour-art-twinkle 2.3s ease-in-out 1.1s infinite; }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* Dotted canvas grid, one subtle dot per 24px cell. */}
        <g className="fill-slate-300/60 dark:fill-slate-600/50">
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 12 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={16 + col * 24} cy={16 + row * 24} r="1" />
            )),
          )}
        </g>

        {/* Square, first onto the canvas. */}
        <rect
          x="42"
          y="34"
          width="40"
          height="40"
          rx="7"
          className="tour-art-el tour-art-square fill-brand-100 stroke-brand-500 dark:fill-brand-500/20 dark:stroke-brand-400"
          strokeWidth="2"
        />

        {/* The connector: draws itself from the square to the circle.
            pathLength=1 normalises the dash so the keyframes don't care
            about the real curve length. */}
        <path
          d="M 86 54 C 122 54 150 62 182 60"
          pathLength="1"
          strokeDasharray="1"
          className="tour-art-arrow fill-none stroke-brand-500 dark:stroke-brand-400"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 178 53 L 188 60 L 177 66"
          className="tour-art-arrowhead fill-none stroke-brand-500 dark:stroke-brand-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Circle, landing as the arrow arrives. */}
        <circle
          cx="214"
          cy="60"
          r="21"
          className="tour-art-el tour-art-circle fill-sky-100 stroke-sky-500 dark:fill-sky-500/20 dark:stroke-sky-400"
          strokeWidth="2"
        />

        {/* Floating diamond: ambient life, independent of the main loop. */}
        <g className="tour-art-el tour-art-diamond">
          <path
            d="M 268 28 L 282 42 L 268 56 L 254 42 Z"
            className="fill-amber-100 stroke-amber-500 dark:fill-amber-400/20 dark:stroke-amber-400"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>

        {/* Sparks, the tour's running motif. */}
        <path
          d="M 116 24 c 1.1 5.5 3.2 7.6 8.7 8.7 -5.5 1.1 -7.6 3.2 -8.7 8.7 -1.1 -5.5 -3.2 -7.6 -8.7 -8.7 5.5 -1.1 7.6 -3.2 8.7 -8.7 Z"
          className="tour-art-el tour-art-spark fill-brand-400 dark:fill-brand-300"
        />
        <path
          d="M 246 82 c 0.7 3.4 2 4.7 5.4 5.4 -3.4 0.7 -4.7 2 -5.4 5.4 -0.7 -3.4 -2 -4.7 -5.4 -5.4 3.4 -0.7 4.7 -2 5.4 -5.4 Z"
          className="tour-art-el tour-art-spark-2 fill-sky-400 dark:fill-sky-300"
        />
      </svg>
    </div>
  );
}
