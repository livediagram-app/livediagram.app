'use client';

// The Drawing tour's welcome card hero (docs/specs/023-drawing-mode/drawing-tour.md "The steps"): a whiteboard where a marker
// stroke draws itself on, a highlighter swipes under it and a star is circled, with the tour's spark motif. The
// welcome art's recipe (TourWelcomeArt, art/TourArtFrame, FacilitateTourArt): pure inline SVG + CSS keyframes, Tailwind
// fill/stroke classes for light and dark, looping with the `animation` shorthand and `infinite`, and still under
// reduced motion (the global collapse in globals.css, plus its own `animation: none`).
export function DrawTourArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .draw-tour-el { transform-box: fill-box; transform-origin: 50% 50%; }
        @keyframes draw-tour-ink {
          0%, 8% { stroke-dashoffset: 1; }
          40%, 88% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes draw-tour-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .draw-tour-stroke { stroke-dasharray: 1; stroke-dashoffset: 1; }
        .draw-tour-scribble { animation: draw-tour-ink 4.8s ease-out infinite; }
        .draw-tour-swipe { animation: draw-tour-ink 4.8s ease-out 0.5s infinite; }
        .draw-tour-ring { animation: draw-tour-ink 4.8s ease-out 1s infinite; }
        .draw-tour-spark { animation: draw-tour-twinkle 2.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .draw-tour-scribble, .draw-tour-swipe, .draw-tour-ring, .draw-tour-spark { animation: none; }
          .draw-tour-stroke { stroke-dashoffset: 0; }
        }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* The whiteboard. */}
        <rect
          x="72"
          y="10"
          width="160"
          height="84"
          rx="6"
          className="fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600"
          strokeWidth="1.5"
        />
        {/* The highlighter's swipe, under the scribble. */}
        <path
          d="M90 52 L168 52"
          pathLength={1}
          strokeWidth="10"
          strokeLinecap="round"
          className="draw-tour-stroke draw-tour-swipe stroke-amber-300/70 dark:stroke-amber-400/60"
        />
        {/* A marker scribble, drawing itself on. */}
        <path
          d="M90 50 C100 34 110 64 120 48 S140 34 150 50 S164 60 170 46"
          pathLength={1}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="draw-tour-stroke draw-tour-scribble stroke-slate-700 dark:stroke-slate-200"
        />
        {/* A star, circled in brand. */}
        <path
          d="M200 40 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z"
          className="fill-rose-400 dark:fill-rose-300"
        />
        <ellipse
          cx="200"
          cy="52"
          rx="20"
          ry="18"
          pathLength={1}
          strokeWidth="2.5"
          fill="none"
          className="draw-tour-stroke draw-tour-ring stroke-brand-500 dark:stroke-brand-300"
        />
        {/* The tour's spark motif. */}
        <path
          d="M44 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"
          className="draw-tour-el draw-tour-spark fill-brand-400 dark:fill-brand-300"
        />
      </svg>
    </div>
  );
}
