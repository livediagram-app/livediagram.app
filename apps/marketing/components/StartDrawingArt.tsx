// Decorative illustration for the "Time to start" CTA band: a pen laying down
// a flourish over a card, an arrow flowing to a second node that pops in, and a
// scatter of sparkles, a quick "start drawing" cue above the heading. White
// line-art reads on the brand-500 band; every moving part reuses the shared
// `.fa-*` classes (apps/marketing/app/feature-art-animations.css), which the
// reduced-motion guard in globals.css settles to a clean static frame. Purely
// decorative, so the whole SVG is aria-hidden.
export function StartDrawingArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 360 130"
      className="mx-auto mb-8 h-28 w-full max-w-md text-white sm:h-32"
      fill="none"
    >
      <defs>
        <marker id="cta-arrowhead" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
        </marker>
      </defs>

      {/* Node A, a card with a couple of content lines. */}
      <rect
        x={40}
        y={50}
        width={96}
        height={48}
        rx={10}
        stroke="currentColor"
        strokeWidth={2.5}
        fill="currentColor"
        fillOpacity={0.12}
      />
      <path
        d="M56 70 h56 M56 82 h36"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
      />

      {/* The flourish the pen is drawing in above the card. */}
      <path
        d="M112 40 q 12 -18 26 -8 t 24 4"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="fa-draw"
      />

      {/* Pen cursor at the end of the flourish. */}
      <g transform="translate(160 30) rotate(38)">
        <path
          d="M0 0 L8 0 L8 20 L4 27 L0 20 Z"
          fill="currentColor"
          fillOpacity={0.95}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path d="M0 6 L8 6" stroke="#0ea5e9" strokeWidth={1.5} />
        <path d="M4 27 L4 22" stroke="#0ea5e9" strokeWidth={1.5} strokeLinecap="round" />
      </g>

      {/* Flowing arrow A → B. */}
      <path
        d="M142 74 H214"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        markerEnd="url(#cta-arrowhead)"
        className="fa-flow"
      />

      {/* Node B, a circle that pops in, with a plus inside (add to canvas). */}
      <circle
        cx={250}
        cy={74}
        r={24}
        stroke="currentColor"
        strokeWidth={2.5}
        fill="currentColor"
        fillOpacity={0.12}
        className="fa-pop"
      />
      <path
        d="M250 64 v20 M240 74 h20"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.7}
        className="fa-pop"
      />

      {/* Sparkles, a little delight, breathing on the shared pulse. */}
      <g className="fa-pulse">
        <path
          d="M306 44 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z"
          fill="currentColor"
          fillOpacity={0.9}
        />
        <path
          d="M300 96 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"
          fill="currentColor"
          fillOpacity={0.75}
        />
        <path
          d="M196 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"
          fill="currentColor"
          fillOpacity={0.75}
        />
      </g>
    </svg>
  );
}
