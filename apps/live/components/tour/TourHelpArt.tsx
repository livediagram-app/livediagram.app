'use client';

// The outro card's animated hero (spec/79): finding a help article. A
// little article card with text lines sits on the dotted canvas; a
// magnifying glass sweeps across it, each line lighting up brand-blue as
// the lens passes, with the tour's spark motif twinkling alongside. Same
// recipe as TourWelcomeArt: pure inline SVG + CSS keyframes, Tailwind
// fill/stroke classes for light/dark, and the global reduced-motion
// collapse leaves a static composed scene.
export function TourHelpArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .tour-help-el { transform-box: fill-box; transform-origin: 50% 50%; }
        @keyframes tour-help-sweep {
          0%, 8% { transform: translate(0px, 0px); }
          30% { transform: translate(54px, 10px); }
          55% { transform: translate(12px, 22px); }
          80% { transform: translate(60px, 30px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes tour-help-line-1 {
          0%, 8%, 40%, 100% { opacity: 0.45; }
          18%, 30% { opacity: 1; }
        }
        @keyframes tour-help-line-2 {
          0%, 35%, 70%, 100% { opacity: 0.45; }
          45%, 60% { opacity: 1; }
        }
        @keyframes tour-help-line-3 {
          0%, 62%, 96% { opacity: 0.45; }
          72%, 88% { opacity: 1; }
        }
        @keyframes tour-help-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .tour-help-lens { animation: tour-help-sweep 5.2s ease-in-out infinite; }
        .tour-help-l1 { animation: tour-help-line-1 5.2s linear infinite; }
        .tour-help-l2 { animation: tour-help-line-2 5.2s linear infinite; }
        .tour-help-l3 { animation: tour-help-line-3 5.2s linear infinite; }
        .tour-help-spark { animation: tour-help-twinkle 2.4s ease-in-out infinite; }
        .tour-help-spark-2 { animation: tour-help-twinkle 2.4s ease-in-out 1.2s infinite; }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* Dotted canvas grid. */}
        <g className="fill-slate-300/60 dark:fill-slate-600/50">
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 12 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={16 + col * 24} cy={16 + row * 24} r="1" />
            )),
          )}
        </g>

        {/* The article: a card with a title bar and three text lines. */}
        <rect
          x="86"
          y="18"
          width="120"
          height="68"
          rx="8"
          className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
          strokeWidth="2"
        />
        <rect
          x="98"
          y="30"
          width="52"
          height="7"
          rx="3.5"
          className="fill-brand-200 dark:fill-brand-500/40"
        />
        <rect
          x="98"
          y="45"
          width="96"
          height="5"
          rx="2.5"
          className="tour-help-l1 fill-brand-500 dark:fill-brand-400"
        />
        <rect
          x="98"
          y="57"
          width="84"
          height="5"
          rx="2.5"
          className="tour-help-l2 fill-brand-500 dark:fill-brand-400"
        />
        <rect
          x="98"
          y="69"
          width="90"
          height="5"
          rx="2.5"
          className="tour-help-l3 fill-brand-500 dark:fill-brand-400"
        />

        {/* The magnifying glass, sweeping over the lines. */}
        <g className="tour-help-el tour-help-lens">
          <circle
            cx="118"
            cy="42"
            r="14"
            className="fill-sky-100/60 stroke-sky-500 dark:fill-sky-500/15 dark:stroke-sky-400"
            strokeWidth="2.5"
          />
          <line
            x1="128"
            y1="52"
            x2="138"
            y2="62"
            className="stroke-sky-500 dark:stroke-sky-400"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* Sparks, the tour's running motif. */}
        <path
          d="M 58 34 c 1.1 5.5 3.2 7.6 8.7 8.7 -5.5 1.1 -7.6 3.2 -8.7 8.7 -1.1 -5.5 -3.2 -7.6 -8.7 -8.7 5.5 -1.1 7.6 -3.2 8.7 -8.7 Z"
          className="tour-help-el tour-help-spark fill-brand-400 dark:fill-brand-300"
        />
        <path
          d="M 240 70 c 0.7 3.4 2 4.7 5.4 5.4 -3.4 0.7 -4.7 2 -5.4 5.4 -0.7 -3.4 -2 -4.7 -5.4 -5.4 3.4 -0.7 4.7 -2 5.4 -5.4 Z"
          className="tour-help-el tour-help-spark-2 fill-sky-400 dark:fill-sky-300"
        />
      </svg>
    </div>
  );
}
