'use client';

import { useRef } from 'react';
import {
  BuildCursor,
  cursorFadeKeyframes,
  cursorKeyframes,
  ease,
  glideStops,
  r1,
  useLoopPhase,
  type Point,
} from './build-animation-kit';

// Decorative "someone is designing a logo" loop, livedesign's loader: on an artboard the "You" cursor draws a mark with
// the pen, anchor by anchor with their handles showing; the path closes and fills, a cut-out lands in it, then the
// cursor drags a corner of the selection to scale the mark up (smart guides lining it up with the artboard's centre)
// and picks a new colour from the swatches before a few sparkles mark it done and the loop restarts. Shown by the
// opening screen (DesignLoading, docs/specs/007-editor/new-design-route.md). A bare illustration with no surface of
// its own, so each host composes it into its own card or screen.
//
// Pure SVG + CSS keyframes generated once at module load (no JS tick, no deps, runs in the static export). Every
// element shares one timeline (a percentage of the same loop) so the drawing stays in sync. The base styles show the
// finished mark with no cursor, so prefers-reduced-motion gets a complete, still picture; the loop only runs when
// motion is allowed.

const DURATION_MS = 7000;

// The artboard and the swatch panel, in viewBox units.
const BOARD = { x: 40, y: 12, w: 180, h: 156 };
const PANEL = { x: 234, y: 40, w: 40, h: 96 };
const SWATCHES = [
  { id: 's1', cy: 62, from: '#fb7185', to: '#e11d48' },
  { id: 's2', cy: 88, from: '#fdba74', to: '#f43f5e' },
  { id: 's3', cy: 114, from: '#c4b5fd', to: '#8b5cf6' },
];
const SWATCH_X = PANEL.x + PANEL.w / 2;

type Seg = { id: string; p: [Point, Point, Point, Point]; draw: [number, number] };
// The mark: four curves round from the top, each drawn by the pen in its window (%).
const SEGS: Seg[] = [
  {
    id: 'p1',
    p: [
      [122, 34],
      [152, 34],
      [186, 60],
      [186, 94],
    ],
    draw: [7, 15],
  },
  {
    id: 'p2',
    p: [
      [186, 94],
      [186, 130],
      [160, 150],
      [128, 150],
    ],
    draw: [16, 24],
  },
  {
    id: 'p3',
    p: [
      [128, 150],
      [96, 150],
      [76, 124],
      [76, 92],
    ],
    draw: [25, 33],
  },
  {
    id: 'p4',
    p: [
      [76, 92],
      [76, 58],
      [96, 34],
      [122, 34],
    ],
    draw: [34, 42],
  },
];
const BOX = { x: 76, y: 34, w: 110, h: 116 };
const CENTER: Point = [BOX.x + BOX.w / 2, BOX.y + BOX.h / 2];
const SCALE = 1.07;
const FILL_AT = 43;
const CUT_AT = 48;
const SELECT: [number, number] = [53, 68];
const DRAG: [number, number] = [57, 66];
const PICK = 76;
const SPARKLE = 81;
const HOLD = 92;
const OUT = 97;

// Each anchor with its handle's two ends, and when the pen sets it down.
const ANCHORS = SEGS.map((s, i) => {
  const prev = SEGS[(i + SEGS.length - 1) % SEGS.length]!;
  return { id: `a${i}`, at: s.p[0], handle: [prev.p[2], s.p[1]] as [Point, Point], t: s.draw[0] };
});

function bezier([a, b, c, d]: Seg['p'], t: number): Point {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return [
    k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0],
    k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1],
  ];
}
const segD = ({ p: [a, b, c, d] }: Seg) =>
  `M ${a[0]} ${a[1]} C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${d[0]} ${d[1]}`;
const MARK_D = `M ${SEGS[0]!.p[0].join(' ')} ${SEGS.map(({ p: [, b, c, d] }) => `C ${b.join(' ')}, ${c.join(' ')}, ${d.join(' ')}`).join(' ')} Z`;

// The selection's bottom-right corner, before and after the scale.
const CORNER: Point = [BOX.x + BOX.w, BOX.y + BOX.h];
const scaled = ([x, y]: Point): Point => [
  CENTER[0] + (x - CENTER[0]) * SCALE,
  CENTER[1] + (y - CENTER[1]) * SCALE,
];

function cursorStops(): [number, Point][] {
  const stops: [number, Point][] = [];
  const rest: Point = [246, 156];
  glideStops(stops, 0, 6, [150, 200], SEGS[0]!.p[0]);
  for (const s of SEGS) {
    const [t0, t1] = s.draw;
    for (let i = 0; i <= 12; i++)
      stops.push([t0 + (t1 - t0) * (i / 12), bezier(s.p, ease(i / 12))]);
  }
  glideStops(stops, 48, 55, SEGS[0]!.p[0], CORNER);
  glideStops(stops, DRAG[0], DRAG[1], CORNER, scaled(CORNER));
  glideStops(stops, 68, PICK - 1, scaled(CORNER), [SWATCH_X + 2, SWATCHES[1]!.cy + 2]);
  glideStops(stops, 80, 88, [SWATCH_X + 2, SWATCHES[1]!.cy + 2], rest);
  stops.push([100, rest]);
  return stops;
}

const segFrames = ({ id, draw: [d0, d1] }: Seg) => `@keyframes ldd-${id} {
  0%, ${d0}% { opacity: 0; stroke-dashoffset: 1; }
  ${d0 + 0.5}% { opacity: 1; stroke-dashoffset: 1; }
  ${d1}%, ${FILL_AT + 3}% { opacity: 1; stroke-dashoffset: 0; }
  ${FILL_AT + 7}%, 100% { opacity: 0; stroke-dashoffset: 0; }
}`;

// An anchor popping in as the pen sets it down, its handle showing for a moment, both gone once the path fills.
const anchorFrames = (id: string, t: number) => `@keyframes ldd-${id} {
  0%, ${t}% { opacity: 0; transform: scale(0.3); }
  ${t + 2}% { opacity: 1; transform: scale(1.3); }
  ${t + 4}%, ${FILL_AT + 3}% { opacity: 1; transform: scale(1); }
  ${FILL_AT + 7}%, 100% { opacity: 0; transform: scale(1); }
}
@keyframes ldd-${id}-handle {
  0%, ${t}% { opacity: 0; }
  ${t + 2}%, ${t + 9}% { opacity: 1; }
  ${t + 13}%, ${FILL_AT + 3}% { opacity: 0.35; }
  ${FILL_AT + 7}%, 100% { opacity: 0; }
}`;

const anim = (name: string, timing = 'linear') =>
  `animation: ${name} ${DURATION_MS}ms ${timing} var(--ldd-delay, 0ms) infinite;`;

const SPARKLES: { x: number; y: number; s: number; at: number }[] = [
  { x: 196, y: 40, s: 7, at: SPARKLE },
  { x: 66, y: 148, s: 5, at: SPARKLE + 2 },
  { x: 182, y: 156, s: 4.5, at: SPARKLE + 4 },
];
const sparklePath = ({ x, y, s }: { x: number; y: number; s: number }) =>
  `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;

const CSS = `
.ldd-anchor, .ldd-cut, .ldd-mark, .ldd-sparkle, .ldd-swatch { transform-box: fill-box; transform-origin: center; }
.ldd-seg { stroke-dasharray: 1; stroke-dashoffset: 0; opacity: 0; }
.ldd-anchor, .ldd-handle, .ldd-select, .ldd-guide, .ldd-cursor, .ldd-sparkle, .ldd-fill-2, .ldd-ring-2 { opacity: 0; }
.ldd-paper { filter: drop-shadow(0 8px 14px rgb(15 23 42 / 0.10)) drop-shadow(0 1px 2px rgb(15 23 42 / 0.08)); }
.dark .ldd-paper { filter: drop-shadow(0 10px 18px rgb(0 0 0 / 0.5)); }
@media (prefers-reduced-motion: no-preference) {
${SEGS.map((s) => `  .ldd-${s.id} { ${anim(`ldd-${s.id}`, 'ease-in-out')} }`).join('\n')}
${ANCHORS.map((a) => `  .ldd-${a.id} { ${anim(`ldd-${a.id}`, 'ease-out')} }\n  .ldd-${a.id}-handle { ${anim(`ldd-${a.id}-handle`)} }`).join('\n')}
  .ldd-fill { ${anim('ldd-fill', 'ease-out')} }
  .ldd-fill-2 { ${anim('ldd-fill-2')} }
  .ldd-cut { ${anim('ldd-cut', 'ease-out')} }
  .ldd-mark { ${anim('ldd-mark')} }
  .ldd-select { ${anim('ldd-select')} }
  .ldd-guide { ${anim('ldd-guide')} }
  .ldd-ring-1 { ${anim('ldd-ring-1')} }
  .ldd-ring-2 { ${anim('ldd-ring-2')} }
  .ldd-swatch-2 { ${anim('ldd-swatch-2', 'ease-out')} }
${SPARKLES.map((_, i) => `  .ldd-sparkle-${i} { ${anim(`ldd-sparkle-${i}`, 'ease-out')} }`).join('\n')}
  .ldd-cursor-move { ${anim('ldd-cursor-move')} }
  .ldd-cursor { ${anim('ldd-cursor-fade')} }
${SEGS.map(segFrames).join('\n')}
${ANCHORS.map((a) => anchorFrames(a.id, a.t)).join('\n')}
@keyframes ldd-fill {
  0%, ${FILL_AT}% { opacity: 0; }
  ${FILL_AT + 5}%, ${HOLD}% { opacity: 1; }
  ${OUT}%, 100% { opacity: 0; }
}
@keyframes ldd-fill-2 {
  0%, ${PICK}% { opacity: 0; }
  ${PICK + 4}%, ${HOLD}% { opacity: 1; }
  ${OUT}%, 100% { opacity: 0; }
}
@keyframes ldd-cut {
  0%, ${CUT_AT}% { opacity: 0; transform: scale(0.2); }
  ${CUT_AT + 3}% { opacity: 1; transform: scale(1.15); }
  ${CUT_AT + 5}%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(1); }
}
@keyframes ldd-mark {
${(() => {
  const lines = [`  0%, ${DRAG[0]}% { transform: scale(1); }`];
  for (let i = 1; i <= 8; i++) {
    lines.push(
      `  ${r1(DRAG[0] + (DRAG[1] - DRAG[0]) * (i / 8))}% { transform: scale(${r1((1 + (SCALE - 1) * ease(i / 8)) * 1000) / 1000}); }`,
    );
  }
  lines.push(`  ${OUT}% { transform: scale(${SCALE}); }`, `  100% { transform: scale(1); }`);
  return lines.join('\n');
})()}
}
@keyframes ldd-select {
  0%, ${SELECT[0]}% { opacity: 0; }
  ${SELECT[0] + 2}%, ${SELECT[1]}% { opacity: 1; }
  ${SELECT[1] + 2}%, 100% { opacity: 0; }
}
@keyframes ldd-guide {
  0%, ${DRAG[0]}% { opacity: 0; }
  ${DRAG[0] + 2}%, ${DRAG[1]}% { opacity: 1; }
  ${DRAG[1] + 3}%, 100% { opacity: 0; }
}
@keyframes ldd-ring-1 {
  0%, ${PICK}% { opacity: 1; }
  ${PICK + 2}%, ${OUT}% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes ldd-ring-2 {
  0%, ${PICK}% { opacity: 0; }
  ${PICK + 2}%, ${OUT}% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes ldd-swatch-2 {
  0%, ${PICK - 1}% { transform: scale(1); }
  ${PICK + 0.5}% { transform: scale(0.85); }
  ${PICK + 3}%, 100% { transform: scale(1); }
}
${SPARKLES.map(
  (s, i) => `@keyframes ldd-sparkle-${i} {
  0%, ${s.at}% { opacity: 0; transform: scale(0) rotate(0deg); }
  ${s.at + 3}% { opacity: 1; transform: scale(1.2) rotate(45deg); }
  ${s.at + 7}% { opacity: 1; transform: scale(1) rotate(90deg); }
  ${s.at + 10}%, 100% { opacity: 0; transform: scale(0.6) rotate(120deg); }
}`,
).join('\n')}
${cursorFadeKeyframes('ldd-cursor-fade')}
${cursorKeyframes('ldd-cursor-move', cursorStops())}
}`;

export function DesignBuildAnimation({
  className = 'max-w-[240px]',
  cursorLabel,
  label = 'Designing a logo',
}: {
  className?: string;
  /** Whose cursor draws (default "You"). */
  cursorLabel?: string;
  /** The picture's accessible name; empty, it is decorative and hidden from assistive tech. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The /new creating stage gives way to the editor's own load in place: the drawing carries on, never restarts.
  useLoopPhase(ref, 'design', DURATION_MS, '--ldd-delay');
  const [cx, cy] = CENTER;

  return (
    <div ref={ref} className={`mx-auto w-full ${className}`}>
      <svg
        viewBox="0 0 300 180"
        className="w-full overflow-visible"
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        <defs>
          {SWATCHES.map((s) => (
            <linearGradient key={s.id} id={`ldd-${s.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={s.from} />
              <stop offset="1" stopColor={s.to} />
            </linearGradient>
          ))}
          <pattern
            id="ldd-grid"
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            x={BOARD.x}
            y={BOARD.y}
          >
            <path
              d="M 12 0 L 0 0 0 12"
              fill="none"
              className="stroke-slate-100 dark:stroke-slate-700/50"
              strokeWidth={0.75}
            />
          </pattern>
        </defs>

        {/* The artboard, with its name tab and a faint layout grid. */}
        <rect
          x={BOARD.x}
          y={BOARD.y - 9}
          width={22}
          height={4}
          rx={2}
          className="fill-slate-300 dark:fill-slate-600"
        />
        <rect
          x={BOARD.x}
          y={BOARD.y}
          width={BOARD.w}
          height={BOARD.h}
          rx={4}
          className="ldd-paper fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
          strokeWidth={1}
        />
        <rect
          x={BOARD.x + 0.5}
          y={BOARD.y + 0.5}
          width={BOARD.w - 1}
          height={BOARD.h - 1}
          rx={4}
          fill="url(#ldd-grid)"
        />

        {/* Smart guides through the artboard's centre while the mark is scaled. */}
        <g className="ldd-guide" stroke="#f43f5e" strokeWidth={0.8} strokeDasharray="3 2">
          <path d={`M ${cx} ${BOARD.y + 4} V ${BOARD.y + BOARD.h - 4}`} />
          <path d={`M ${BOARD.x + 4} ${cy} H ${BOARD.x + BOARD.w - 4}`} />
        </g>

        <g className="ldd-mark">
          {/* The filled mark, its second colour crossfading in when the swatch is picked, and its cut-out. */}
          <g className="ldd-fill">
            <path d={MARK_D} fill="url(#ldd-s1)" />
            <path className="ldd-fill-2" d={MARK_D} fill="url(#ldd-s2)" />
            <circle className="ldd-cut fill-white dark:fill-slate-800" cx={150} cy={68} r={15} />
            <circle className="ldd-cut" cx={150} cy={68} r={6} fill="url(#ldd-s1)" />
            <circle className="ldd-fill-2" cx={150} cy={68} r={6} fill="url(#ldd-s2)" />
          </g>

          {/* The pen's path, anchors and handles. */}
          {SEGS.map((s) => (
            <path
              key={s.id}
              className={`ldd-seg ldd-${s.id}`}
              d={segD(s)}
              pathLength={1}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          ))}
          {ANCHORS.map((a) => (
            <g key={a.id}>
              <g className={`ldd-handle ldd-${a.id}-handle`} stroke="#fb7185" strokeWidth={0.9}>
                <path d={`M ${a.handle[0].join(' ')} L ${a.handle[1].join(' ')}`} />
                {a.handle.map(([hx, hy], k) => (
                  <circle
                    key={k}
                    cx={hx}
                    cy={hy}
                    r={2.2}
                    className="fill-white dark:fill-slate-800"
                  />
                ))}
              </g>
              <rect
                className={`ldd-anchor ldd-${a.id} fill-white dark:fill-slate-800`}
                x={a.at[0] - 3}
                y={a.at[1] - 3}
                width={6}
                height={6}
                rx={1}
                stroke="#f43f5e"
                strokeWidth={1.4}
              />
            </g>
          ))}

          {/* The selection the cursor scales by its corner. */}
          <g className="ldd-select">
            <rect
              x={BOX.x}
              y={BOX.y}
              width={BOX.w}
              height={BOX.h}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
            />
            {[
              [BOX.x, BOX.y],
              [BOX.x + BOX.w, BOX.y],
              [BOX.x, BOX.y + BOX.h],
              [BOX.x + BOX.w, BOX.y + BOX.h],
            ].map(([hx, hy], k) => (
              <rect
                key={k}
                x={hx! - 3}
                y={hy! - 3}
                width={6}
                height={6}
                rx={1}
                fill="white"
                stroke="#3b82f6"
                strokeWidth={1.2}
              />
            ))}
          </g>
        </g>

        {SPARKLES.map((s, i) => (
          <path
            key={i}
            className={`ldd-sparkle ldd-sparkle-${i}`}
            d={sparklePath(s)}
            fill="#fb7185"
          />
        ))}

        {/* The swatch panel: the picked colour wears the ring. */}
        <rect
          x={PANEL.x}
          y={PANEL.y}
          width={PANEL.w}
          height={PANEL.h}
          rx={10}
          className="ldd-paper fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
          strokeWidth={1}
        />
        {SWATCHES.map((s, i) => (
          <g key={s.id}>
            <circle
              className={i === 0 ? 'ldd-ring-1' : i === 1 ? 'ldd-ring-2' : undefined}
              cx={SWATCH_X}
              cy={s.cy}
              r={11.5}
              fill="none"
              stroke={i < 2 ? s.to : 'none'}
              strokeWidth={1.5}
            />
            <circle
              className={i === 1 ? 'ldd-swatch ldd-swatch-2' : undefined}
              cx={SWATCH_X}
              cy={s.cy}
              r={8}
              fill={`url(#ldd-${s.id})`}
            />
          </g>
        ))}

        <BuildCursor moveClass="ldd-cursor-move" fadeClass="ldd-cursor" label={cursorLabel} />
      </svg>
      <style>{CSS}</style>
    </div>
  );
}
