'use client';

import { useLayoutEffect, useRef } from 'react';

// Decorative "someone is drawing a diagram" loop: a collaborator cursor
// labelled "You" places a card, drags a connector that draws under it to
// the next card, and so on until three cards are wired; a pulse of light
// then runs along every connector before the diagram dissolves and the
// loop restarts. It echoes the editor's core gesture (add a shape, wire it
// up) and its live cursors. Shared by the opening screen (DocumentLoading,
// docs/specs/007-editor/new-document-route.md), the OAuth completing-sign-in
// card (/sso-callback) and the MCP consent card. A bare illustration with no
// surface of its own, so each host composes it into its own card or screen.
//
// Pure SVG + CSS keyframes generated once at module load (no JS tick, no
// deps, runs in the static export). Every element shares one timeline (a
// percentage of the same loop) so the build stays in sync. The base styles
// show the finished diagram with no cursor, so prefers-reduced-motion gets a
// complete, still picture; the loop only runs when motion is allowed.

const DURATION_MS = 6000;

// Card geometry, in viewBox units.
const W = 84;
const H = 46;

type Node = { id: string; x: number; y: number; color: string; pop: number };
// `pop` = % of the loop where the card lands under the cursor.
const NODES: Node[] = [
  { id: 'n1', x: 16, y: 18, color: '#0ea5e9', pop: 8 },
  { id: 'n2', x: 200, y: 18, color: '#8b5cf6', pop: 33 },
  { id: 'n3', x: 108, y: 116, color: '#10b981', pop: 54 },
];

type Point = [number, number];
type Edge = {
  id: string;
  from: string;
  to: string;
  // Cubic bezier: start, control 1, control 2, end.
  p: [Point, Point, Point, Point];
  // % window over which the connector draws (the cursor rides its tip).
  draw: [number, number];
};
const EDGES: Edge[] = [
  {
    id: 'e1',
    from: 'n1',
    to: 'n2',
    p: [
      [100, 41],
      [138, 22],
      [162, 22],
      [196, 38],
    ],
    draw: [19, 33],
  },
  {
    id: 'e2',
    from: 'n2',
    to: 'n3',
    p: [
      [242, 64],
      [242, 112],
      [230, 139],
      [196, 139],
    ],
    draw: [40, 54],
  },
  {
    id: 'e3',
    from: 'n1',
    to: 'n3',
    p: [
      [58, 64],
      [58, 112],
      [70, 139],
      [104, 139],
    ],
    draw: [63, 77],
  },
];

// Shared tail: connectors pulse, then everything dissolves together.
const PULSE: [number, number] = [78, 90];
const HOLD = 90;
const OUT = 97;

const nodeById = (id: string) => NODES.find((n) => n.id === id)!;

function bezier([a, b, c, d]: Edge['p'], t: number): Point {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [
    k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0],
    k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1],
  ];
}

const pathD = ({ p: [a, b, c, d] }: Edge) =>
  `M ${a[0]} ${a[1]} C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${d[0]} ${d[1]}`;

// Where the pointer's tip rests when it "holds" a card: just inside its
// lower-right quarter, so the card reads as placed by the cursor.
const grip = (n: Node): Point => [n.x + W * 0.62, n.y + H * 0.6];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const r1 = (v: number) => Math.round(v * 10) / 10;

// The cursor's path as dense keyframe stops: eased glides between gestures,
// and while a connector draws, samples of that connector's own curve at the
// same pace as its dash, so the tip stays glued to the line being drawn.
function cursorStops(): string {
  const stops: [number, Point][] = [];
  const glide = (t0: number, t1: number, from: Point, to: Point) => {
    for (let i = 0; i <= 8; i++) {
      const e = ease(i / 8);
      stops.push([
        t0 + (t1 - t0) * (i / 8),
        [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e],
      ]);
    }
  };
  const ride = (edge: Edge) => {
    const [t0, t1] = edge.draw;
    for (let i = 0; i <= 12; i++) {
      // The dash draws with ease-in-out too, so sample the curve on the
      // same eased clock.
      stops.push([t0 + (t1 - t0) * (i / 12), bezier(edge.p, ease(i / 12))]);
    }
  };
  const [e1, e2, e3] = EDGES as [Edge, Edge, Edge];
  const n1 = nodeById('n1');
  const rest: Point = [214, 104];
  glide(0, 7, [150, 190], grip(n1));
  glide(12, 19, grip(n1), e1.p[0]);
  ride(e1);
  glide(35, 40, e1.p[3], e2.p[0]);
  ride(e2);
  glide(57, 63, e2.p[3], e3.p[0]);
  ride(e3);
  glide(79, 88, e3.p[3], rest);
  stops.push([100, rest]);
  return stops
    .map(([t, [x, y]]) => `  ${r1(t)}% { transform: translate(${r1(x)}px, ${r1(y)}px); }`)
    .join('\n');
}

function nodeFrames(n: Node): string {
  const s = n.pop;
  return `@keyframes ldb-${n.id} {
  0%, ${s}% { opacity: 0; transform: scale(0.6); }
  ${s + 4}% { opacity: 1; transform: scale(1.06); }
  ${s + 7}%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(0.96); }
}
@keyframes ldb-${n.id}-ring {
  0%, ${s + 1}% { opacity: 0; }
  ${s + 4}%, ${s + 9}% { opacity: 1; }
  ${s + 14}%, 100% { opacity: 0; }
}`;
}

function edgeFrames(e: Edge): string {
  const [d0, d1] = e.draw;
  return `@keyframes ldb-${e.id}-line {
  0%, ${d0}% { opacity: 0; stroke-dashoffset: 1; }
  ${d0 + 0.5}% { opacity: 1; stroke-dashoffset: 1; }
  ${d1}%, ${HOLD}% { opacity: 1; stroke-dashoffset: 0; }
  ${OUT}%, 100% { opacity: 0; stroke-dashoffset: 0; }
}
@keyframes ldb-${e.id}-head {
  0%, ${d1 - 1}% { opacity: 0; transform: scale(0.3); }
  ${d1 + 3}%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(0.6); }
}`;
}

// The pulse is a short bright dash travelling the connector once, all three
// together, as the "it's live" beat before the dissolve.
const PULSE_FRAMES = `@keyframes ldb-pulse {
  0%, ${PULSE[0]}% { opacity: 0; stroke-dashoffset: 0.16; }
  ${PULSE[0] + 1}% { opacity: 1; }
  ${PULSE[1] - 1}% { opacity: 1; }
  ${PULSE[1]}%, 100% { opacity: 0; stroke-dashoffset: -1; }
}`;

const CURSOR_FADE = `@keyframes ldb-cursor-fade {
  0% { opacity: 0; }
  3%, 84% { opacity: 1; }
  89%, 100% { opacity: 0; }
}`;

const anim = (name: string, timing = 'linear') =>
  `animation: ${name} ${DURATION_MS}ms ${timing} var(--ldb-delay, 0ms) infinite;`;

const CSS = `
.ldb-node, .ldb-head, .ldb-ring { transform-box: fill-box; transform-origin: center; }
.ldb-line { stroke-dasharray: 1; stroke-dashoffset: 0; }
.ldb-pulse { stroke-dasharray: 0.16 2; opacity: 0; }
.ldb-cursor { opacity: 0; }
.ldb-ring { opacity: 0; }
.ldb-card { filter: drop-shadow(0 6px 10px rgb(15 23 42 / 0.10)) drop-shadow(0 1px 2px rgb(15 23 42 / 0.08)); }
.dark .ldb-card { filter: drop-shadow(0 8px 14px rgb(0 0 0 / 0.45)); }
@media (prefers-reduced-motion: no-preference) {
${NODES.map((n) => `  .ldb-${n.id} { ${anim(`ldb-${n.id}`, 'ease-out')} }\n  .ldb-${n.id}-ring { ${anim(`ldb-${n.id}-ring`)} }`).join('\n')}
${EDGES.map((e) => `  .ldb-${e.id}-line { ${anim(`ldb-${e.id}-line`, 'ease-in-out')} }\n  .ldb-${e.id}-head { ${anim(`ldb-${e.id}-head`, 'ease-out')} }`).join('\n')}
  .ldb-pulse { ${anim('ldb-pulse', 'ease-in-out')} }
  .ldb-cursor-move { ${anim('ldb-cursor-move')} }
  .ldb-cursor { ${anim('ldb-cursor-fade')} }
${NODES.map(nodeFrames).join('\n')}
${EDGES.map(edgeFrames).join('\n')}
${PULSE_FRAMES}
${CURSOR_FADE}
@keyframes ldb-cursor-move {
${cursorStops()}
}
}`;

// The loop's phase is measured from the first mount in this document, so a
// remount (the /new creating stage giving way to the editor's own load, see
// the spec's in-place handoff) continues the drawing instead of restarting.
let epoch: number | null = null;

export function DiagramBuildAnimation({ className = 'max-w-[240px]' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const now = performance.now();
    epoch ??= now;
    ref.current?.style.setProperty('--ldb-delay', `${-((now - epoch) % DURATION_MS)}ms`);
  }, []);

  return (
    <div ref={ref} className={`mx-auto w-full ${className}`}>
      <svg
        viewBox="0 0 300 180"
        className="w-full overflow-visible"
        role="img"
        aria-label="Building a diagram"
      >
        <defs>
          {EDGES.map((e) => {
            const [a, , , d] = e.p;
            return (
              <linearGradient
                key={e.id}
                id={`ldb-grad-${e.id}`}
                gradientUnits="userSpaceOnUse"
                x1={a[0]}
                y1={a[1]}
                x2={d[0]}
                y2={d[1]}
              >
                <stop offset="0" stopColor={nodeById(e.from).color} />
                <stop offset="1" stopColor={nodeById(e.to).color} />
              </linearGradient>
            );
          })}
        </defs>

        {EDGES.map((e) => {
          const [, , c, d] = e.p;
          const angle = (Math.atan2(d[1] - c[1], d[0] - c[0]) * 180) / Math.PI;
          const color = nodeById(e.to).color;
          return (
            <g key={e.id}>
              <path
                className={`ldb-line ldb-${e.id}-line`}
                d={pathD(e)}
                pathLength={1}
                fill="none"
                stroke={`url(#ldb-grad-${e.id})`}
                strokeWidth={2.25}
                strokeLinecap="round"
              />
              <path
                className="ldb-pulse"
                d={pathD(e)}
                pathLength={1}
                fill="none"
                stroke="white"
                strokeOpacity={0.9}
                strokeWidth={2.25}
                strokeLinecap="round"
              />
              <g transform={`rotate(${angle} ${d[0]} ${d[1]})`}>
                <path
                  className={`ldb-head ldb-${e.id}-head`}
                  d={`M ${d[0] - 7} ${d[1] - 5} L ${d[0]} ${d[1]} L ${d[0] - 7} ${d[1] + 5}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          );
        })}

        {NODES.map((n) => (
          <g key={n.id} className={`ldb-node ldb-${n.id}`}>
            {/* Selection ring: flashes as the card lands, like a fresh
                shape the cursor just dropped. */}
            <rect
              className={`ldb-ring ldb-${n.id}-ring`}
              x={n.x - 4}
              y={n.y - 4}
              width={W + 8}
              height={H + 8}
              rx={13}
              fill="none"
              stroke={n.color}
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <g className="ldb-card">
              <rect
                x={n.x}
                y={n.y}
                width={W}
                height={H}
                rx={10}
                className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
                strokeWidth={1}
              />
            </g>
            <rect x={n.x + 10} y={n.y + 12} width={12} height={12} rx={4} fill={n.color} />
            <rect
              x={n.x + 28}
              y={n.y + 13}
              width={W - 44}
              height={4}
              rx={2}
              className="fill-slate-300 dark:fill-slate-500"
            />
            <rect
              x={n.x + 28}
              y={n.y + 21}
              width={W - 54}
              height={3}
              rx={1.5}
              className="fill-slate-200 dark:fill-slate-600"
            />
            <rect
              x={n.x + 10}
              y={n.y + 32}
              width={W - 20}
              height={3}
              rx={1.5}
              fill={n.color}
              fillOpacity={0.25}
            />
          </g>
        ))}

        {/* The collaborator cursor. The outer group carries the path, the
            inner one the fade, so the two keyframe sets stay independent. */}
        <g className="ldb-cursor-move" aria-hidden="true">
          <g className="ldb-cursor">
            <path
              d="M0 0 L0 15.5 L4.2 11.6 L7.2 18.2 L10 17 L7.1 10.6 L12.6 10.4 Z"
              className="fill-brand-500 dark:fill-brand-400"
              stroke="white"
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
            <rect
              x={11}
              y={17}
              width={28}
              height={15}
              rx={7.5}
              className="fill-brand-500 dark:fill-brand-400"
            />
            <text
              x={25}
              y={27.6}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill="white"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              You
            </text>
          </g>
        </g>
      </svg>
      <style>{CSS}</style>
    </div>
  );
}
