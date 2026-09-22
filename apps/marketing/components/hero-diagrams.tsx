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
    </>
  );
}

// Card 2 diagram: a mind map that builds out from a central node, then (when
// playing) a Highlighter stroke (spec/81) swipes across the Design node and a
// laser pointer rings the top-left node, moves to the bottom-right node and
// rings it. It does not recolour. Reuses the hero-pop / hero-line build
// keyframes; the highlighter and laser use their own hero-* keyframes.
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

      {/* Highlighter: a translucent marker swipe across Design, drawn left to
          right after the map builds. It sits under the laser and is held
          settled on the peeking card. */}
      <rect
        className="hero-highlight"
        x="412"
        y="36"
        width="126"
        height="26"
        rx="5"
        fill="#fde047"
        fillOpacity="0.55"
        stroke="none"
      />

      {/* Laser pointer: rings Research (top-left), then moves to Launch
          (bottom-right) and rings it. Only on the active card. */}
      {playing ? (
        <g>
          <ellipse className="hero-laser-ring hero-laser-a" cx="125" cy="48" rx="74" ry="30" />
          <ellipse className="hero-laser-ring hero-laser-b" cx="475" cy="232" rx="74" ry="30" />
          {/* The trail the pointer leaves as it travels from the first ring
              to the second, drawn under the dot and fading once it lands. */}
          <path className="hero-laser-trail" d="M150 60 L450 220" />
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

// Card 2 diagram: the flowchart presented as a slide deck (spec/31). Four
// slides, each the elements the presenter picked from the same flowchart,
// step through it a piece at a time and end on the whole picture. Every
// slide is the subset drawn at the flowchart's own coordinates, then fitted
// to the stage (the outer transform), and faded in and out on its beat of
// the 16s cycle (hero-slide-N on the inner group). The peeking card settles
// on the last slide, the complete flowchart.
const FLOW_NODES = {
  start: { x: 80, y: 34, w: 120, h: 44, rx: 22, label: 'Start' },
  plan: { x: 80, y: 118, w: 120, h: 52, rx: 8, label: 'Plan' },
  ready: { x: 220, y: 108, w: 140, h: 64, rx: 0, label: 'Ready?' },
  ship: { x: 400, y: 118, w: 120, h: 52, rx: 8, label: 'Ship' },
  done: { x: 400, y: 206, w: 120, h: 44, rx: 22, label: 'Done' },
} as const;
type FlowNode = keyof typeof FLOW_NODES;
const FLOW_EDGES: { from: FlowNode; to: FlowNode; d: string }[] = [
  { from: 'start', to: 'plan', d: 'M140 78 L140 118 M134 111 L140 118 L146 111' },
  { from: 'plan', to: 'ready', d: 'M200 140 L220 140 M214 134 L220 140 L214 146' },
  { from: 'ready', to: 'ship', d: 'M360 140 L400 140 M394 134 L400 140 L394 146' },
  { from: 'ship', to: 'done', d: 'M460 170 L460 206 M454 199 L460 206 L466 199' },
];
export const SLIDES: { name: string; nodes: FlowNode[] }[] = [
  { name: 'Kick-off', nodes: ['start', 'plan'] },
  { name: 'The decision', nodes: ['plan', 'ready'] },
  { name: 'Shipping', nodes: ['ready', 'ship', 'done'] },
  { name: 'The whole flow', nodes: ['start', 'plan', 'ready', 'ship', 'done'] },
];

// Fit a slide's bounding box into the stage's safe area, centred, never
// blown up past 1.5x so a two-box slide still reads as a diagram.
function slideTransform(nodes: FlowNode[]): string {
  const boxes = nodes.map((n) => FLOW_NODES[n]);
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const s = Math.min(480 / (maxX - minX), 250 / (maxY - minY), 1.5);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return `translate(${(300 - s * cx).toFixed(1)} ${(140 - s * cy).toFixed(1)}) scale(${s.toFixed(3)})`;
}

export function SlideDeckDiagram() {
  return (
    <>
      {SLIDES.map((slide, i) => (
        <g key={slide.name} transform={slideTransform(slide.nodes)}>
          <g className={`hero-slide hero-slide${i + 1}`}>
            <g fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round">
              {FLOW_EDGES.filter(
                (e) => slide.nodes.includes(e.from) && slide.nodes.includes(e.to),
              ).map((e) => (
                <path key={`${e.from}-${e.to}`} d={e.d} />
              ))}
            </g>
            <g fill="#dbeafe" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round">
              {slide.nodes.map((n) => {
                const b = FLOW_NODES[n];
                return (
                  <g key={n}>
                    {n === 'ready' ? (
                      <polygon points="290,108 360,140 290,172 220,140" />
                    ) : (
                      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} />
                    )}
                    <text
                      x={b.x + b.w / 2}
                      y={b.y + b.h / 2 + 5}
                      textAnchor="middle"
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                      fontWeight="600"
                      fontSize="14"
                      fill={BLUE_TEXT}
                      stroke="none"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </g>
      ))}
    </>
  );
}

// Card 5 diagram: a three-service architecture that gets talked about. The
// services build in, then a comment pin lands on the API with its thread
// beside it (spec/136), then an assigned action lands on the database
// (spec/68) and, near the end of the cycle, gets ticked off. The peeking
// card settles with both in place and the action done.
export function ArchitectureDiagram({ theme }: { theme: Theme }) {
  const boxes = [
    { cls: 'hero-pop1', x: 60, label: 'Web app' },
    { cls: 'hero-pop2', x: 240, label: 'API' },
    { cls: 'hero-pop3', x: 420, label: 'Database' },
  ];
  const label = (x: number, y: number, text: string, size = 14, fill = theme.text) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      fontWeight="600"
      fontSize={size}
      fill={fill}
      stroke="none"
    >
      {text}
    </text>
  );
  return (
    <>
      <g style={{ color: theme.stroke }} fill="none">
        <path
          className="hero-line1"
          d="M180 144 L240 144 M234 138 L240 144 L234 150"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="hero-line2"
          d="M360 144 L420 144 M414 138 L420 144 L414 150"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g fill={theme.fill} stroke={theme.stroke} strokeWidth="2" strokeLinejoin="round">
        {boxes.map((b) => (
          <g key={b.label} className={b.cls}>
            <rect x={b.x} y="118" width="120" height="52" rx="8" />
            {label(b.x + 60, 149, b.label)}
          </g>
        ))}
      </g>

      {/* Comment pin on the API box, with the thread beside it. */}
      <g className="hero-note">
        <circle cx="360" cy="118" r="11" fill="#ec4899" stroke="white" strokeWidth="2" />
        {label(360, 122, 'JR', 9, 'white')}
        <g transform="translate(372 52)">
          <rect x="0" y="0" width="150" height="52" rx="8" fill="white" stroke="#e2e8f0" />
          <circle cx="16" cy="16" r="7" fill="#ec4899" />
          {label(16, 19, 'JR', 7, 'white')}
          <rect x="30" y="11" width="64" height="7" rx="3.5" fill="#cbd5e1" />
          <rect x="10" y="30" width="118" height="6" rx="3" fill="#e2e8f0" />
          <rect x="10" y="40" width="84" height="6" rx="3" fill="#e2e8f0" />
        </g>
      </g>

      {/* Assigned action on the database, ticked off near the end. */}
      {/* Positioned by an outer group: the pop animation sets a CSS transform
          on the inner one, which would replace an SVG transform attribute. */}
      <g transform="translate(396 190)">
        <g className="hero-action">
          <rect x="0" y="0" width="168" height="40" rx="8" fill="white" stroke="#e2e8f0" />
          <rect
            x="10"
            y="11"
            width="18"
            height="18"
            rx="4"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <path
            className="hero-action-tick"
            d="M14 20 L18 24 L25 15"
            fill="none"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="38"
            y="17"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="600"
            fontSize="10"
            fill="#0f172a"
            stroke="none"
          >
            Add a read replica
          </text>
          <text
            x="38"
            y="30"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight="500"
            fontSize="8.5"
            fill="#64748b"
            stroke="none"
          >
            Assigned to JR
          </text>
          <circle cx="152" cy="20" r="8" fill="#ec4899" />
          {label(152, 23, 'JR', 7, 'white')}
        </g>
      </g>
    </>
  );
}
