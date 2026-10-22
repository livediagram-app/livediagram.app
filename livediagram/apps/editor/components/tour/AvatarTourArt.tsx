'use client';

// The Avatar tour's welcome card hero (docs/specs/008-canvas/avatar-tour.md "The steps"): two pixel characters on a
// dotted canvas, one waving, a speech bubble rising from the other and fading, with the tour's spark motif. The
// welcome art's recipe (TourWelcomeArt, DrawTourArt): pure inline SVG + CSS keyframes, Tailwind fill/stroke classes
// for light and dark, looping with the `animation` shorthand and `infinite`, and still under reduced motion (the
// global collapse in globals.css, plus its own `animation: none`).

// One pixel character on a 4px grid, its feet at (x, y). `arm` raises the right arm (the wave).
function Pixel({
  x,
  y,
  shirt,
  hair,
  arm,
}: {
  x: number;
  y: number;
  shirt: string;
  hair: string;
  arm?: boolean;
}) {
  const p = 4;
  const at = (cx: number, cy: number, w = 1, h = 1) => ({
    x: x + cx * p,
    y: y + cy * p,
    width: w * p,
    height: h * p,
  });
  return (
    <g>
      <ellipse
        cx={x + 2 * p}
        cy={y + 0.5}
        rx={10}
        ry={2}
        className="fill-slate-900/15 dark:fill-black/30"
      />
      {/* Legs. */}
      <rect {...at(0.5, -3, 1, 3)} className="fill-slate-700 dark:fill-slate-300" />
      <rect {...at(2.5, -3, 1, 3)} className="fill-slate-700 dark:fill-slate-300" />
      {/* Body. */}
      <rect {...at(0, -7, 4, 4)} className={shirt} />
      {/* Arms. */}
      <rect {...at(-1, -7, 1, 3)} className="fill-orange-200" />
      {arm ? (
        <rect {...at(4, -10, 1, 3)} className="avatar-tour-el avatar-tour-wave fill-orange-200" />
      ) : (
        <rect {...at(4, -7, 1, 3)} className="fill-orange-200" />
      )}
      {/* Head and hair. */}
      <rect {...at(0, -11, 4, 4)} className="fill-orange-200" />
      <rect {...at(0, -12, 4, 1.5)} className={hair} />
      <rect {...at(1, -9.5, 0.5, 0.5)} className="fill-slate-800" />
      <rect {...at(2.5, -9.5, 0.5, 0.5)} className="fill-slate-800" />
    </g>
  );
}

export function AvatarTourArt() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{`
        .avatar-tour-el { transform-box: fill-box; transform-origin: 50% 100%; }
        @keyframes avatar-tour-rise {
          0% { opacity: 0; transform: translateY(6px) scale(0.7); }
          12% { opacity: 1; transform: translateY(0) scale(1.05); }
          18% { transform: translateY(0) scale(1); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-26px); }
        }
        @keyframes avatar-tour-wave {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        @keyframes avatar-tour-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
        }
        .avatar-tour-bubble { animation: avatar-tour-rise 3.6s ease-out infinite; }
        .avatar-tour-wave { animation: avatar-tour-wave 0.9s ease-in-out infinite; }
        .avatar-tour-spark { transform-origin: 50% 50%; animation: avatar-tour-twinkle 2.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .avatar-tour-bubble, .avatar-tour-wave, .avatar-tour-spark { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {/* The dotted canvas. */}
        <pattern id="avatar-tour-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" className="fill-slate-300 dark:fill-slate-600" />
        </pattern>
        <rect x="0" y="0" width="304" height="104" fill="url(#avatar-tour-dots)" />
        {/* A waving character, on the left. */}
        <Pixel x={104} y={92} shirt="fill-violet-500" hair="fill-amber-800" arm />
        {/* A speaking character, on the right, its words rising away. */}
        <Pixel x={184} y={92} shirt="fill-teal-500" hair="fill-slate-800" />
        <g className="avatar-tour-el avatar-tour-bubble">
          <rect
            x="160"
            y="14"
            width="64"
            height="22"
            rx="8"
            strokeWidth="1.5"
            className="fill-white stroke-teal-500 dark:fill-slate-900"
          />
          <path
            d="M188 36 l4 5 4 -5z"
            className="fill-white stroke-teal-500 dark:fill-slate-900"
            strokeWidth="1.5"
          />
          <rect x="168" y="21" width="36" height="3" rx="1.5" className="fill-slate-400" />
          <rect
            x="168"
            y="27"
            width="24"
            height="3"
            rx="1.5"
            className="fill-slate-300 dark:fill-slate-500"
          />
        </g>
        {/* The tour's spark motif. */}
        <path
          d="M44 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"
          className="avatar-tour-el avatar-tour-spark fill-brand-400 dark:fill-brand-300"
        />
      </svg>
    </div>
  );
}
