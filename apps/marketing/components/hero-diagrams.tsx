// Per-card SVG diagrams for the marketing hero animation. Lifted out
// of HeroIllustration.tsx (was 854 lines) so the orchestration file
// (window chrome + card rotation + animation timing) reads as
// layout / state and these stay as pure SVG markup. Each diagram is
// a stateless function: inputs are limited to the `playing` flag
// (mind map only) and a Theme tint. The hero-* class names drive
// the keyframe animations defined alongside HeroIllustration's
// stylesheet, so the markup must keep those classes intact.

const BLUE_TEXT = '#0c4a6e';

// Tint applied to a diagram canvas. The flowchart animates between
// two of these via the hero-theme keyframes; the mind map and
// timeline each hold one for the life of the animation.
export type Theme = { canvas: string; fill: string; stroke: string; text: string };

export function FlowchartDiagram() {
  return (
    <>
      <g
        className="hero-theme"
        fill="#dbeafe"
        stroke="#0284c7"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <g className="hero-pop1">
          <rect x="80" y="34" width="120" height="44" rx="22" />
          <text
            x="140"
            y="62"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            fill={BLUE_TEXT}
            stroke="none"
          >
            Start
          </text>
        </g>

        <g className="hero-pop2">
          <rect x="80" y="118" width="120" height="52" rx="8" />
          <text
            className="hero-text-out"
            x="140"
            y="150"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            fill={BLUE_TEXT}
            stroke="none"
          >
            Plan
          </text>
          <text
            className="hero-text-in"
            x="140"
            y="150"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            fill={BLUE_TEXT}
            stroke="none"
          >
            Build
          </text>
        </g>

        <g className="hero-pop3">
          <polygon points="290,108 360,140 290,172 220,140" />
          <text
            x="290"
            y="145"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="13"
            fill={BLUE_TEXT}
            stroke="none"
          >
            Ready?
          </text>
        </g>

        <g className="hero-pop4">
          <rect x="400" y="118" width="120" height="52" rx="8" />
          <text
            x="460"
            y="150"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            fill={BLUE_TEXT}
            stroke="none"
          >
            Ship
          </text>
        </g>

        <g className="hero-pop5">
          <rect x="400" y="206" width="120" height="44" rx="22" />
          <text
            x="460"
            y="234"
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="14"
            fill={BLUE_TEXT}
            stroke="none"
          >
            Done
          </text>
        </g>
      </g>

      {/* Arrows (each a path that traces the line then its barbs, so the head
          draws in last with the stroke). */}
      <g style={{ color: '#0284c7' }} fill="none">
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

      {/* A comment thread pops onto the Ship box */}
      <g transform="translate(508 102)">
        <g className="hero-comment">
          <circle cx="0" cy="0" r="9" fill="#f59e0b" stroke="none" />
          <text x="0" y="3.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
            1
          </text>
          <g transform="translate(12 -8)">
            <rect width="96" height="46" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1" />
            <circle cx="13" cy="14" r="5" fill="#ec4899" />
            <rect x="23" y="10" width="58" height="6" rx="3" fill="#e2e8f0" />
            <rect x="13" y="26" width="70" height="5" rx="2.5" fill="#f1f5f9" />
            <rect x="13" y="35" width="50" height="5" rx="2.5" fill="#f1f5f9" />
          </g>
        </g>
      </g>
    </>
  );
}

// Card 2 diagram: a mind map that builds out from a central node, then (when
// playing) a laser pointer rings the top-left node, moves to the bottom-right
// node and rings it. It does not recolour. Reuses the hero-pop / hero-line
// build keyframes; the laser uses its own hero-laser-* keyframes.
export function MindMapDiagram({ playing, theme }: { playing: boolean; theme: Theme }) {
  const nodes = [
    { cls: 'hero-pop2', x: 70, y: 30, w: 110, h: 36, label: 'Research' },
    { cls: 'hero-pop3', x: 420, y: 30, w: 110, h: 36, label: 'Design' },
    { cls: 'hero-pop4', x: 70, y: 214, w: 110, h: 36, label: 'Build' },
    { cls: 'hero-pop5', x: 420, y: 214, w: 110, h: 36, label: 'Launch' },
  ];
  const label = (x: number, y: number, text: string, size = 13) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      fontWeight="600"
      fontSize={size}
      fill={theme.text}
      stroke="none"
    >
      {text}
    </text>
  );
  return (
    <>
      {/* Branches draw first underneath the nodes. */}
      <g style={{ color: theme.stroke }} fill="none">
        <path
          className="hero-line1"
          d="M255 125 L180 66"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line2"
          d="M345 125 L420 66"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line3"
          d="M255 155 L180 214"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line4"
          d="M345 155 L420 214"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      <g fill={theme.fill} stroke={theme.stroke} strokeWidth="2" strokeLinejoin="round">
        {/* Central node */}
        <g className="hero-pop1">
          <rect x="250" y="120" width="100" height="40" rx="20" />
          {label(300, 145, 'Project')}
        </g>
        {/* Branch nodes */}
        {nodes.map((nd) => (
          <g key={nd.label} className={nd.cls}>
            <rect x={nd.x} y={nd.y} width={nd.w} height={nd.h} rx="8" />
            {label(nd.x + nd.w / 2, nd.y + nd.h / 2 + 4, nd.label)}
          </g>
        ))}
      </g>

      {/* Laser pointer: rings Research (top-left), then moves to Launch
          (bottom-right) and rings it. Only on the active card. */}
      {playing ? (
        <g>
          <ellipse className="hero-laser-ring hero-laser-a" cx="125" cy="48" rx="74" ry="30" />
          <ellipse className="hero-laser-ring hero-laser-b" cx="475" cy="232" rx="74" ry="30" />
          <circle className="hero-laser-dot" cx="0" cy="0" r="4.5" />
        </g>
      ) : null}
    </>
  );
}

// Card 3 diagram: a release timeline. The axis draws left to right (four
// hero-line segments) while milestones pop in above and below it. It does not
// recolour.
export function TimelineDiagram({ theme }: { theme: Theme }) {
  const milestones = [
    { cls: 'hero-pop1', x: 80, above: true, title: 'Kickoff', date: 'Jan' },
    { cls: 'hero-pop2', x: 190, above: false, title: 'Design', date: 'Mar' },
    { cls: 'hero-pop3', x: 300, above: true, title: 'Build', date: 'Jun' },
    { cls: 'hero-pop4', x: 410, above: false, title: 'Beta', date: 'Sep' },
    { cls: 'hero-pop5', x: 520, above: true, title: 'Launch', date: 'Dec' },
  ];
  return (
    <>
      {/* Axis, drawn in four segments left to right. */}
      <g style={{ color: theme.stroke }} fill="none">
        <path
          className="hero-line1"
          d="M80 140 L190 140"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line2"
          d="M190 140 L300 140"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line3"
          d="M300 140 L410 140"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line4"
          d="M410 140 L520 140"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      <g fill={theme.fill} stroke={theme.stroke} strokeWidth="2" strokeLinejoin="round">
        {milestones.map((m) => {
          const cardY = m.above ? 70 : 168;
          const connFrom = m.above ? 106 : 168;
          const connTo = m.above ? 134 : 146;
          return (
            <g key={m.title} className={m.cls}>
              <line
                x1={m.x}
                y1={connFrom}
                x2={m.x}
                y2={connTo}
                stroke={theme.stroke}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={m.x} cy="140" r="6" fill={theme.stroke} stroke="none" />
              <rect x={m.x - 46} y={cardY} width="92" height="36" rx="6" />
              <text
                x={m.x}
                y={cardY + 16}
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="600"
                fontSize="12"
                fill={theme.text}
                stroke="none"
              >
                {m.title}
              </text>
              <text
                x={m.x}
                y={cardY + 28}
                textAnchor="middle"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="500"
                fontSize="9"
                fill="#64748b"
                stroke="none"
              >
                {m.date}
              </text>
            </g>
          );
        })}
      </g>
    </>
  );
}
