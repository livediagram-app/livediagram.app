'use client';

// Decorative "building a diagram" loop. Nodes drop in and arrows draw
// to connect them, echoing the editor's core gesture: add a shape,
// wire it up. Shared by the OAuth completing-sign-in screen
// (/sso-callback) and the diagram loading placeholder
// (DiagramLoading). Pure SVG + CSS keyframes (no JS tick, no extra
// deps, runs in the static export), and it honours
// prefers-reduced-motion by sitting on the finished diagram instead of
// animating. Its own module per CLAUDE.md's no-god-files rule; the
// consuming screens just compose it.
//
// Every element shares one timeline (a percentage of the same loop) so
// the diagram builds, holds complete, then dissolves and repeats in
// sync rather than as a drifting wave.

const NODE_W = 64;
const NODE_H = 36;

// `appear` = % of the loop where the node pops in.
const NODES = [
  { id: 'n1', x: 14, y: 24, appear: 4 },
  { id: 'n2', x: 182, y: 24, appear: 25 },
  { id: 'n3', x: 98, y: 96, appear: 46 },
];

// `draw` = % where the line starts drawing; `head` = % where the
// arrowhead pops in (just after the line reaches the target).
const EDGES = [
  { id: 'e1', x1: 78, y1: 42, x2: 178, y2: 42, draw: 11, head: 22 },
  { id: 'e2', x1: 52, y1: 60, x2: 112, y2: 94, draw: 32, head: 43 },
  { id: 'e3', x1: 208, y1: 60, x2: 150, y2: 94, draw: 53, head: 64 },
];

// Shared dissolve window: everything fades together near the cycle end.
const HOLD = 88;
const OUT = 97;
const DURATION = '4.4s';

function nodeFrames(id: string, s: number): string {
  return `@keyframes ldsso-${id} {
  0%, ${s}% { opacity: 0; transform: scale(0.82); }
  ${s + 7}%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(0.95); }
}`;
}

function lineFrames(id: string, draw: number): string {
  return `@keyframes ldsso-${id}-line {
  0%, ${draw}% { opacity: 0; stroke-dashoffset: 1; }
  ${draw + 0.5}% { opacity: 1; stroke-dashoffset: 1; }
  ${draw + 11}%, ${HOLD}% { opacity: 1; stroke-dashoffset: 0; }
  ${OUT}%, 100% { opacity: 0; stroke-dashoffset: 0; }
}`;
}

function headFrames(id: string, h: number): string {
  return `@keyframes ldsso-${id}-head {
  0%, ${h}% { opacity: 0; transform: scale(0.4); }
  ${h + 4}%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(0.6); }
}`;
}

// Base state shows the finished diagram (so reduced-motion users get a
// complete, static picture); the loop only runs when motion is allowed.
const CSS = `
.ld-sso-node, .ld-sso-head { transform-box: fill-box; transform-origin: center; }
.ld-sso-line { stroke-dasharray: 1; stroke-dashoffset: 0; }
@media (prefers-reduced-motion: no-preference) {
${NODES.map((n) => `  .ld-sso-${n.id} { animation: ldsso-${n.id} ${DURATION} ease-in-out infinite; }`).join('\n')}
${EDGES.map((e) => `  .ld-sso-line-${e.id} { animation: ldsso-${e.id}-line ${DURATION} ease-in-out infinite; }`).join('\n')}
${EDGES.map((e) => `  .ld-sso-head-${e.id} { animation: ldsso-${e.id}-head ${DURATION} ease-in-out infinite; }`).join('\n')}
${NODES.map((n) => nodeFrames(n.id, n.appear)).join('\n')}
${EDGES.map((e) => lineFrames(e.id, e.draw)).join('\n')}
${EDGES.map((e) => headFrames(e.id, e.head)).join('\n')}
}`;

export function DiagramBuildAnimation() {
  return (
    <div className="mx-auto w-full max-w-[240px] text-brand-500">
      <svg viewBox="0 0 260 150" className="w-full" role="img" aria-label="Building a diagram">
        {EDGES.map((e) => {
          const angle = (Math.atan2(e.y2 - e.y1, e.x2 - e.x1) * 180) / Math.PI;
          return (
            <g key={e.id}>
              <path
                className={`ld-sso-line ld-sso-line-${e.id}`}
                d={`M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`}
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <g transform={`rotate(${angle} ${e.x2} ${e.y2})`}>
                <polygon
                  className={`ld-sso-head ld-sso-head-${e.id}`}
                  points={`${e.x2},${e.y2} ${e.x2 - 9},${e.y2 - 4.5} ${e.x2 - 9},${e.y2 + 4.5}`}
                  fill="currentColor"
                />
              </g>
            </g>
          );
        })}
        {NODES.map((n) => (
          <g key={n.id} className={`ld-sso-node ld-sso-${n.id}`}>
            <rect
              x={n.x}
              y={n.y}
              width={NODE_W}
              height={NODE_H}
              rx={7}
              fill="currentColor"
              fillOpacity={0.1}
              stroke="currentColor"
              strokeWidth={2}
            />
            <rect
              x={n.x + 12}
              y={n.y + 12}
              width={NODE_W - 34}
              height={4}
              rx={2}
              fill="currentColor"
              fillOpacity={0.55}
            />
            <rect
              x={n.x + 12}
              y={n.y + 21}
              width={NODE_W - 22}
              height={4}
              rx={2}
              fill="currentColor"
              fillOpacity={0.3}
            />
          </g>
        ))}
      </svg>
      <style>{CSS}</style>
    </div>
  );
}
