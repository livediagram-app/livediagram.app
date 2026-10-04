// The hero's Diagram window's flowchart (docs/specs/019-marketing/marketing-site.md "Hero"), as
// pure SVG markup: a stateless function, every colour from the canvas palette. The hero-* class
// names drive the keyframes in app/hero-animations.css, so the markup must keep them intact. The
// Draw and Illustrate windows draw themselves in hero-draw-board.tsx and hero-illustrate-page.tsx.

// Every window wears the Default scheme (the --art-* palette in hero-animations.css,
// its light or dark half with the appearance): shapes in its ink, arrows and connectors
// in its arrow colour. While the flowchart recolours to Forest or Pine, its canvas
// carries --hero-label / --hero-arrow so the labels and arrows follow it.
const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const FLOW_LABEL = 'fill-[var(--hero-label,var(--art-ink-text))]';

export function FlowchartDiagram() {
  return (
    <>
      <g className={`hero-theme ${INK}`} strokeWidth="2" strokeLinejoin="round">
        <g className="hero-pop1">
          <rect x="80" y="34" width="120" height="44" rx="22" />
          <text
            className={FLOW_LABEL}
            x="140"
            y="62"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            stroke="none"
          >
            Start
          </text>
        </g>

        <g className="hero-pop2">
          <rect x="80" y="118" width="120" height="52" rx="8" />
          <text
            className={`hero-text-out ${FLOW_LABEL}`}
            x="140"
            y="150"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            stroke="none"
          >
            Plan
          </text>
          <text
            className={`hero-text-in ${FLOW_LABEL}`}
            x="140"
            y="150"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            stroke="none"
          >
            Build
          </text>
        </g>

        <g className="hero-pop3">
          <polygon points="290,108 360,140 290,172 220,140" />
          <text
            className={FLOW_LABEL}
            x="290"
            y="145"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="13"
            stroke="none"
          >
            Ready?
          </text>
        </g>

        <g className="hero-pop4">
          <rect x="400" y="118" width="120" height="52" rx="8" />
          <text
            className={FLOW_LABEL}
            x="460"
            y="150"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            stroke="none"
          >
            Ship
          </text>
        </g>

        <g className="hero-pop5">
          <rect x="400" y="206" width="120" height="44" rx="22" />
          <text
            className={FLOW_LABEL}
            x="460"
            y="234"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            stroke="none"
          >
            Done
          </text>
        </g>
      </g>

      {/* Arrows (each a path that traces the line then its barbs, so the head
          draws in last with the stroke). */}
      <g className="text-[var(--hero-arrow,var(--art-arrow))]" fill="none">
        <path
          className="hero-line1"
          d="M140 78 L140 118 M134 111 L140 118 L146 111"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="hero-line2"
          d="M200 140 L220 140 M214 134 L220 140 L214 146"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="hero-line3"
          d="M360 140 L400 140 M394 134 L400 140 L394 146"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="hero-line4"
          d="M460 170 L460 206 M454 199 L460 206 L466 199"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </>
  );
}
