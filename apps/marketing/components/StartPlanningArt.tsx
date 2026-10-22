// Decorative illustration for the "just try it" card: a small board of three columns, a card popping
// into the first, a ticked card settling in Done, and a scatter of sparkles, a quick "start
// planning" cue above the copy. White line-art reads on the brand-700 card; every moving part reuses
// the shared `.fa-*` classes (apps/marketing/app/feature-art/core.css), which the reduced-motion guard
// in globals.css settles to a clean static frame. Purely decorative, so the whole SVG is aria-hidden.

const COLUMNS = [52, 148, 244] as const;

export function StartPlanningArt({
  className = 'mx-auto mb-8 h-28 w-full max-w-md sm:h-32',
}: {
  className?: string;
}) {
  return (
    <svg aria-hidden viewBox="0 0 360 130" className={`text-white ${className}`} fill="none">
      {/* Three columns, each with its heading line. */}
      {COLUMNS.map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={14}
            width={84}
            height={104}
            rx={10}
            stroke="currentColor"
            strokeWidth={2}
            strokeOpacity={0.45}
            fill="currentColor"
            fillOpacity={0.06}
          />
          <path
            d={`M${x + 12} 30 h30`}
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.6}
          />
        </g>
      ))}

      {/* To do: a resting card, and a new one popping in under it. */}
      <rect x={60} y={42} width={68} height={28} rx={6} fill="currentColor" fillOpacity={0.22} />
      <path d="M68 56 h40" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <g className="fa-pop">
        <rect
          x={60}
          y={78}
          width={68}
          height={28}
          rx={6}
          stroke="currentColor"
          strokeWidth={2}
          fill="currentColor"
          fillOpacity={0.12}
        />
        <path
          d="M86 92 h16 M94 84 v16"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </g>

      {/* Doing: a card in progress. */}
      <rect x={156} y={42} width={68} height={28} rx={6} fill="currentColor" fillOpacity={0.22} />
      <path d="M164 56 h32" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />

      {/* Done: a card whose tick draws itself in. */}
      <rect x={252} y={42} width={68} height={28} rx={6} fill="currentColor" fillOpacity={0.22} />
      <path
        d="M262 56 l6 6 12 -12"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="fa-draw"
      />

      {/* Sparkles, a little delight, breathing on the shared pulse. */}
      <g className="fa-pulse">
        <path
          d="M334 20 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z"
          fill="currentColor"
          fillOpacity={0.9}
        />
        <path
          d="M24 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"
          fill="currentColor"
          fillOpacity={0.75}
        />
      </g>
    </svg>
  );
}
