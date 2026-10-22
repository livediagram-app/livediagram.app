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

// Decorative "someone is writing a document" loop, livedocuments' loader: a page whose heading and paragraphs write
// themselves line by line behind a caret, while the "You" cursor drags a picture in between them; then the work fans
// out into its other shapes, an infographic to one side and a slide to the other, a sheen runs across the page, and
// it all dissolves before the loop restarts. Shown by the opening screen (DocumentLoading,
// docs/specs/007-editor/new-document-route.md). A bare illustration with no surface of its own, so each host composes
// it into its own card or screen.
//
// Pure SVG + CSS keyframes generated once at module load (no JS tick, no deps, runs in the static export). Every
// element shares one timeline (a percentage of the same loop) so the writing stays in sync. The base styles show the
// finished page, infographic and slide with no cursor, so prefers-reduced-motion gets a complete, still picture; the
// loop only runs when motion is allowed.

const DURATION_MS = 7000;

// The page, in viewBox units.
const PX = 98;
const PY = 12;
const PW = 104;
const PH = 152;

// A line of the page: where it sits, how long it is, how it looks, and the % window in which it writes.
type Line = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: string;
  write: [number, number];
};
const LINES: Line[] = [
  { id: 'k', x: 12, y: 12, w: 22, h: 3.5, tone: 'kicker', write: [6, 8] },
  { id: 'h1', x: 12, y: 20, w: 74, h: 6.5, tone: 'heading', write: [8.5, 15] },
  { id: 'h2', x: 12, y: 30, w: 46, h: 6.5, tone: 'heading', write: [15.5, 20] },
  { id: 'b1', x: 12, y: 44, w: 80, h: 3, tone: 'body', write: [22, 26.5] },
  { id: 'b2', x: 12, y: 51, w: 76, h: 3, tone: 'body', write: [27, 31.5] },
  { id: 'b3', x: 12, y: 58, w: 54, h: 3, tone: 'body', write: [32, 35] },
  { id: 'b4', x: 12, y: 116, w: 80, h: 3, tone: 'body', write: [55, 59] },
  { id: 'b5', x: 12, y: 123, w: 72, h: 3, tone: 'body', write: [59.5, 63.5] },
  { id: 'b6', x: 12, y: 130, w: 44, h: 3, tone: 'body', write: [64, 66.5] },
];
const TONES: Record<string, string> = {
  kicker: 'fill-amber-500',
  heading: 'fill-slate-700 dark:fill-slate-200',
  body: 'fill-slate-300 dark:fill-slate-600',
};

// The picture the cursor drags in: from beside the page, tilted, to its place between the paragraphs.
const IMG = { x: PX + 12, y: PY + 68, w: 80, h: 40 };
const IMG_FROM: Point = [96, -18];
const IMG_SHOW = 36;
const DRAG: [number, number] = [40, 52];
// The fan-out into an infographic and a slide, the sheen, and the dissolve.
const FAN: [number, number] = [67, 76];
const SHEEN: [number, number] = [79, 89];
const HOLD = 92;
const OUT = 97;

// The caret rides the tip of the line being written, and jumps to the next line between them.
function caretStops(): [number, Point][] {
  const stops: [number, Point][] = [];
  for (const l of LINES) {
    const y = PY + l.y + l.h / 2 - 4;
    stops.push([l.write[0], [PX + l.x, y]]);
    for (let i = 1; i <= 6; i++) {
      stops.push([
        l.write[0] + (l.write[1] - l.write[0]) * (i / 6),
        [PX + l.x + l.w * ease(i / 6), y],
      ]);
    }
  }
  const [first] = stops;
  const last = stops[stops.length - 1]!;
  return [[0, first![1]], ...stops, [100, last[1]]];
}

const grip = ([dx, dy]: Point): Point => [IMG.x + IMG.w * 0.6 + dx, IMG.y + IMG.h * 0.6 + dy];

function cursorStops(): [number, Point][] {
  const stops: [number, Point][] = [];
  const rest: Point = [246, 158];
  stops.push([0, rest]);
  glideStops(stops, 30, 38, rest, grip(IMG_FROM));
  glideStops(stops, DRAG[0], DRAG[1], grip(IMG_FROM), grip([0, 0]));
  glideStops(stops, 55, 64, grip([0, 0]), rest);
  stops.push([100, rest]);
  return stops;
}

// The picture's ride: offset and tilt from its place, eased on the same clock as the cursor.
function imageFrames(): string {
  const at = (t: number, [x, y]: Point, tilt: number, scale: number) =>
    `  ${r1(t)}% { transform: translate(${r1(x)}px, ${r1(y)}px) rotate(${r1(tilt)}deg) scale(${r1(scale * 100) / 100}); }`;
  const lines = [
    at(0, IMG_FROM, 5, 0.9),
    at(IMG_SHOW, IMG_FROM, 5, 0.9),
    at(IMG_SHOW + 3, IMG_FROM, 5, 1.04),
  ];
  for (let i = 0; i <= 8; i++) {
    const e = ease(i / 8);
    lines.push(
      at(
        DRAG[0] + (DRAG[1] - DRAG[0]) * (i / 8),
        [IMG_FROM[0] * (1 - e), IMG_FROM[1] * (1 - e)],
        5 * (1 - e) - 2 * Math.sin(Math.PI * e),
        1.04,
      ),
    );
  }
  lines.push(at(DRAG[1] + 2, [0, 0], 0, 1), at(100, [0, 0], 0, 1));
  return `@keyframes lpb-img {\n${lines.join('\n')}\n}
@keyframes lpb-img-fade {
  0%, ${IMG_SHOW}% { opacity: 0; }
  ${IMG_SHOW + 2}%, ${HOLD}% { opacity: 1; }
  ${OUT}%, 100% { opacity: 0; }
}
@keyframes lpb-img-ring {
  0%, ${DRAG[1]}% { opacity: 0; }
  ${DRAG[1] + 2}%, ${DRAG[1] + 7}% { opacity: 1; }
  ${DRAG[1] + 11}%, 100% { opacity: 0; }
}`;
}

const lineFrames = (l: Line) => `@keyframes lpb-${l.id} {
  0%, ${l.write[0]}% { transform: scaleX(0); opacity: 1; }
  ${l.write[1]}%, ${HOLD}% { transform: scaleX(1); opacity: 1; }
  ${OUT}%, 100% { transform: scaleX(1); opacity: 0; }
}`;

// The infographic and the slide: tucked behind the page, then fanned out to each side.
const fanFrames = (name: string, [dx, dy]: Point, tilt: number) => `@keyframes ${name} {
  0%, ${FAN[0]}% { opacity: 0; transform: translate(${-dx}px, ${-dy}px) rotate(0deg) scale(0.9); }
  ${FAN[0] + 2}% { opacity: 1; }
  ${FAN[1]}% { transform: translate(${r1(dx * 0.08)}px, ${r1(dy * 0.08)}px) rotate(${r1(tilt * 1.1)}deg) scale(1.02); }
  ${FAN[1] + 3}%, ${HOLD}% { opacity: 1; transform: translate(0px, 0px) rotate(${tilt}deg) scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: translate(0px, 0px) rotate(${tilt}deg) scale(1); }
}`;

// The infographic's bars, growing once it is out.
const BARS = [
  { h: 16, color: '#f59e0b', at: FAN[1] - 1 },
  { h: 26, color: '#f97316', at: FAN[1] + 1 },
  { h: 20, color: '#14b8a6', at: FAN[1] + 3 },
];
const barFrames = (i: number, at: number) => `@keyframes lpb-bar-${i} {
  0%, ${at}% { transform: scaleY(0); }
  ${at + 5}%, 100% { transform: scaleY(1); }
}`;

const anim = (name: string, timing = 'linear') =>
  `animation: ${name} ${DURATION_MS}ms ${timing} var(--lpb-delay, 0ms) infinite;`;

const CSS = `
.lpb-line { transform-box: fill-box; transform-origin: left center; }
.lpb-img, .lpb-fan { transform-box: fill-box; transform-origin: center; }
.lpb-bar { transform-box: fill-box; transform-origin: center bottom; }
.lpb-caret, .lpb-cursor, .lpb-img-ring, .lpb-sheen { opacity: 0; }
.lpb-paper { filter: drop-shadow(0 8px 14px rgb(15 23 42 / 0.10)) drop-shadow(0 1px 2px rgb(15 23 42 / 0.08)); }
.dark .lpb-paper { filter: drop-shadow(0 10px 18px rgb(0 0 0 / 0.5)); }
@media (prefers-reduced-motion: no-preference) {
${LINES.map((l) => `  .lpb-${l.id} { ${anim(`lpb-${l.id}`)} }`).join('\n')}
  .lpb-caret-move { ${anim('lpb-caret-move')} }
  .lpb-caret { ${anim('lpb-caret')} }
  .lpb-caret-blink { animation: lpb-blink 1s steps(1) infinite; }
  .lpb-img { ${anim('lpb-img')} }
  .lpb-img-fade { ${anim('lpb-img-fade')} }
  .lpb-img-ring { ${anim('lpb-img-ring')} }
  .lpb-fan-l { ${anim('lpb-fan-l', 'ease-out')} }
  .lpb-fan-r { ${anim('lpb-fan-r', 'ease-out')} }
${BARS.map((_, i) => `  .lpb-bar-${i} { ${anim(`lpb-bar-${i}`, 'ease-out')} }`).join('\n')}
  .lpb-sheen { ${anim('lpb-sheen', 'ease-in-out')} }
  .lpb-cursor-move { ${anim('lpb-cursor-move')} }
  .lpb-cursor { ${anim('lpb-cursor-fade')} }
${LINES.map(lineFrames).join('\n')}
@keyframes lpb-caret {
  0%, ${LINES[0]!.write[0] - 1}% { opacity: 0; }
  ${LINES[0]!.write[0]}%, ${LINES[LINES.length - 1]!.write[1] + 2}% { opacity: 1; }
  ${LINES[LINES.length - 1]!.write[1] + 3}%, 100% { opacity: 0; }
}
@keyframes lpb-blink { 0% { opacity: 1; } 50% { opacity: 0.15; } }
${cursorKeyframes('lpb-caret-move', caretStops())}
${imageFrames()}
${fanFrames('lpb-fan-l', [-34, 6], -8)}
${fanFrames('lpb-fan-r', [36, 10], 7)}
${BARS.map((b, i) => barFrames(i, b.at)).join('\n')}
@keyframes lpb-sheen {
  0%, ${SHEEN[0]}% { opacity: 0; transform: translateX(-90px); }
  ${SHEEN[0] + 1}% { opacity: 1; }
  ${SHEEN[1] - 1}% { opacity: 1; }
  ${SHEEN[1]}%, 100% { opacity: 0; transform: translateX(150px); }
}
${cursorFadeKeyframes('lpb-cursor-fade')}
${cursorKeyframes('lpb-cursor-move', cursorStops())}
}`;

const PAPER = 'lpb-paper fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700';
const INK = 'fill-slate-200 dark:fill-slate-600';

export function PageBuildAnimation({
  className = 'max-w-[240px]',
  cursorLabel,
  label = 'Writing a document',
}: {
  className?: string;
  /** Whose cursor places the picture (default "You"). */
  cursorLabel?: string;
  /** The picture's accessible name; empty, it is decorative and hidden from assistive tech. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The /new creating stage gives way to the editor's own load in place: the writing carries on, never restarts.
  useLoopPhase(ref, 'page', DURATION_MS, '--lpb-delay');

  return (
    <div ref={ref} className={`mx-auto w-full ${className}`}>
      <svg
        viewBox="0 0 300 180"
        className="w-full overflow-visible"
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        <defs>
          <linearGradient id="lpb-photo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="lpb-sheen-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.55" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <clipPath id="lpb-page-clip">
            <rect x={PX} y={PY} width={PW} height={PH} rx={6} />
          </clipPath>
        </defs>

        {/* The infographic, fanned out to the left. */}
        <g className="lpb-fan lpb-fan-l">
          <rect x={30} y={40} width={66} height={104} rx={5} className={PAPER} strokeWidth={1} />
          <rect
            x={38}
            y={48}
            width={34}
            height={5}
            rx={2.5}
            className="fill-slate-700 dark:fill-slate-200"
          />
          <rect x={38} y={57} width={46} height={3} rx={1.5} className={INK} />
          <circle
            cx={63}
            cy={80}
            r={11}
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth={5}
          />
          <circle
            cx={63}
            cy={80}
            r={11}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={5}
            pathLength={100}
            strokeDasharray="64 100"
            transform="rotate(-90 63 80)"
          />
          {BARS.map((b, i) => (
            <rect
              key={i}
              className={`lpb-bar lpb-bar-${i}`}
              x={42 + i * 15}
              y={132 - b.h}
              width={10}
              height={b.h}
              rx={2}
              fill={b.color}
            />
          ))}
          <rect x={38} y={134} width={50} height={1.5} rx={0.75} className={INK} />
        </g>

        {/* The slide, fanned out to the right. */}
        <g className="lpb-fan lpb-fan-r">
          <rect x={186} y={96} width={98} height={58} rx={5} className={PAPER} strokeWidth={1} />
          <rect
            x={194}
            y={106}
            width={40}
            height={5}
            rx={2.5}
            className="fill-slate-700 dark:fill-slate-200"
          />
          <rect x={194} y={116} width={34} height={3} rx={1.5} className={INK} />
          <rect x={194} y={122} width={28} height={3} rx={1.5} className={INK} />
          <rect x={240} y={104} width={36} height={42} rx={3} fill="url(#lpb-photo)" />
          <circle cx={266} cy={113} r={4} fill="white" fillOpacity={0.85} />
          <path
            d="M 240 146 L 252 128 L 262 140 L 268 133 L 276 146 Z"
            fill="#c2410c"
            fillOpacity={0.55}
          />
        </g>

        {/* The page. */}
        <rect x={PX} y={PY} width={PW} height={PH} rx={6} className={PAPER} strokeWidth={1} />
        {LINES.map((l) => (
          <rect
            key={l.id}
            className={`lpb-line lpb-${l.id} ${TONES[l.tone]}`}
            x={PX + l.x}
            y={PY + l.y}
            width={l.w}
            height={l.h}
            rx={l.h / 2}
          />
        ))}
        <rect x={PX + PW / 2 - 6} y={PY + PH - 10} width={12} height={2} rx={1} className={INK} />

        {/* The picture, dragged in from beside the page. */}
        <g className="lpb-img-fade">
          <g className="lpb-img">
            <rect
              className="lpb-img-ring"
              x={IMG.x - 3.5}
              y={IMG.y - 3.5}
              width={IMG.w + 7}
              height={IMG.h + 7}
              rx={6.5}
              fill="none"
              stroke="#f59e0b"
              strokeOpacity={0.7}
              strokeWidth={1.4}
              strokeDasharray="4 3"
            />
            <rect x={IMG.x} y={IMG.y} width={IMG.w} height={IMG.h} rx={4} fill="url(#lpb-photo)" />
            <circle cx={IMG.x + 60} cy={IMG.y + 11} r={5.5} fill="white" fillOpacity={0.85} />
            <path
              d={`M ${IMG.x} ${IMG.y + IMG.h} L ${IMG.x + 24} ${IMG.y + 16} L ${IMG.x + 42} ${IMG.y + 32} L ${IMG.x + 54} ${IMG.y + 22} L ${IMG.x + IMG.w} ${IMG.y + IMG.h} Z`}
              fill="#c2410c"
              fillOpacity={0.55}
            />
          </g>
        </g>

        {/* The sheen across the finished page. */}
        <g clipPath="url(#lpb-page-clip)">
          <rect
            className="lpb-sheen"
            x={PX - 40}
            y={PY - 20}
            width={40}
            height={PH + 40}
            fill="url(#lpb-sheen-grad)"
            transform={`rotate(14 ${PX} ${PY + PH / 2})`}
          />
        </g>

        {/* The caret, at the tip of the line being written. */}
        <g className="lpb-caret-move" aria-hidden="true">
          <g className="lpb-caret">
            <rect
              className="lpb-caret-blink fill-brand-500 dark:fill-brand-400"
              x={0.5}
              y={0}
              width={1.6}
              height={8}
              rx={0.8}
            />
          </g>
        </g>

        <BuildCursor moveClass="lpb-cursor-move" fadeClass="lpb-cursor" label={cursorLabel} />
      </svg>
      <style>{CSS}</style>
    </div>
  );
}
