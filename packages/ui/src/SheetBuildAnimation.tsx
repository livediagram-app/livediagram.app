'use client';

import { useRef } from 'react';
import {
  BuildCursor,
  cursorFadeKeyframes,
  cursorKeyframes,
  glideStops,
  useLoopPhase,
  type Point,
} from './build-animation-kit';

// Decorative "someone is filling in a sheet" loop, DiagramBuildAnimation's sibling for data: the same "You" cursor
// types a value into each row of a small table, a bar in the next column growing with it; then it drags down the
// column, and the total lands with its own bar, before the table's numbers dissolve and the loop restarts. A Sheet
// shows it while it loads (docs/specs/029-sheets/sheet.md "Loading").
//
// Pure SVG + CSS keyframes generated once at module load, one shared timeline. The base styles show the finished
// table with no cursor, so prefers-reduced-motion gets a complete, still picture; the loop only runs when motion is
// allowed.

const DURATION_MS = 6000;

// The table, in viewBox units: a row-number gutter, then Month, Sales and a bar column.
const X0 = 24;
const Y0 = 20;
const GUTTER = 22;
const HEAD = 22;
const ROW = 24;
const COLS = [80, 70, 80];
const colX = (c: number) => X0 + GUTTER + COLS.slice(0, c).reduce((a, b) => a + b, 0);
const rowY = (r: number) => Y0 + HEAD + r * ROW;
const WIDTH = GUTTER + COLS.reduce((a, b) => a + b, 0);
const ROWS = 5;
const BAR_MAX = 62;

type Row = { id: string; label: string; value: number; color: string; at: number };
// `at` = % of the loop where the value is typed.
const ROWS_DATA: Row[] = [
  { id: 'v1', label: 'Jan', value: 12, color: '#0ea5e9', at: 10 },
  { id: 'v2', label: 'Feb', value: 20, color: '#8b5cf6', at: 28 },
  { id: 'v3', label: 'Mar', value: 16, color: '#10b981', at: 46 },
];
const TOTAL = ROWS_DATA.reduce((a, r) => a + r.value, 0);
const BAR_SCALE = BAR_MAX / TOTAL;
// The drag down the column, the total landing, then the dissolve.
const DRAG: [number, number] = [56, 64];
const TOTAL_AT = 70;
const HOLD = 90;
const OUT = 97;

// Where the cursor rests while it types in a value cell: in its left half, clear of the number (right-aligned).
const grip = (r: number): Point => [colX(1) + COLS[1]! * 0.3, rowY(r) + ROW * 0.62];

function cursorStops(): [number, Point][] {
  const stops: [number, Point][] = [];
  const rest: Point = [238, 170];
  glideStops(stops, 0, 8, [150, 200], grip(0));
  glideStops(stops, 18, 26, grip(0), grip(1));
  glideStops(stops, 36, 44, grip(1), grip(2));
  glideStops(stops, 52, DRAG[0], grip(2), grip(0));
  glideStops(stops, DRAG[0], DRAG[1], grip(0), grip(2));
  glideStops(stops, 65, 69, grip(2), grip(3));
  glideStops(stops, 80, 88, grip(3), rest);
  stops.push([100, rest]);
  return stops;
}

// A value popping into its cell, its cell's selection flashing, and its bar growing.
const valueFrames = (id: string, s: number) => `@keyframes lsb-${id} {
  0%, ${s}% { opacity: 0; transform: scale(0.6); }
  ${s + 4}% { opacity: 1; transform: scale(1.08); }
  ${s + 7}%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(0.96); }
}
@keyframes lsb-${id}-ring {
  0%, ${s - 2}% { opacity: 0; }
  ${s}%, ${s + 9}% { opacity: 1; }
  ${s + 13}%, 100% { opacity: 0; }
}
@keyframes lsb-${id}-bar {
  0%, ${s + 2}% { opacity: 0; transform: scaleX(0); }
  ${s + 3}% { opacity: 1; transform: scaleX(0); }
  ${s + 12}%, ${HOLD}% { opacity: 1; transform: scaleX(1); }
  ${OUT}%, 100% { opacity: 0; transform: scaleX(1); }
}`;

// The column picked by the drag: one cell growing to three.
const RANGE_FRAMES = `@keyframes lsb-range {
  0%, ${DRAG[0] - 1}% { opacity: 0; transform: scaleY(0.333); }
  ${DRAG[0]}% { opacity: 1; transform: scaleY(0.333); }
  ${DRAG[1]}%, ${TOTAL_AT + 6}% { opacity: 1; transform: scaleY(1); }
  ${TOTAL_AT + 10}%, 100% { opacity: 0; transform: scaleY(1); }
}`;

const anim = (name: string, timing = 'linear') =>
  `animation: ${name} ${DURATION_MS}ms ${timing} var(--lsb-delay, 0ms) infinite;`;

const ALL = [...ROWS_DATA.map((r) => ({ id: r.id, at: r.at })), { id: 'total', at: TOTAL_AT }];

const CSS = `
.lsb-value, .lsb-ring { transform-box: fill-box; transform-origin: center; }
.lsb-bar { transform-box: fill-box; transform-origin: left center; }
.lsb-range { transform-box: fill-box; transform-origin: center top; opacity: 0; }
.lsb-cursor, .lsb-ring { opacity: 0; }
.lsb-card { filter: drop-shadow(0 6px 10px rgb(15 23 42 / 0.10)) drop-shadow(0 1px 2px rgb(15 23 42 / 0.08)); }
.dark .lsb-card { filter: drop-shadow(0 8px 14px rgb(0 0 0 / 0.45)); }
@media (prefers-reduced-motion: no-preference) {
${ALL.map(
  (v) =>
    `  .lsb-${v.id} { ${anim(`lsb-${v.id}`, 'ease-out')} }\n  .lsb-${v.id}-ring { ${anim(`lsb-${v.id}-ring`)} }\n  .lsb-${v.id}-bar { ${anim(`lsb-${v.id}-bar`, 'ease-in-out')} }`,
).join('\n')}
  .lsb-range { ${anim('lsb-range', 'ease-in-out')} }
  .lsb-cursor-move { ${anim('lsb-cursor-move')} }
  .lsb-cursor { ${anim('lsb-cursor-fade')} }
${ALL.map((v) => valueFrames(v.id, v.at)).join('\n')}
${RANGE_FRAMES}
${cursorFadeKeyframes('lsb-cursor-fade')}
${cursorKeyframes('lsb-cursor-move', cursorStops())}
}
@media (prefers-reduced-motion: reduce) {
  .lsb-value, .lsb-ring, .lsb-bar, .lsb-range, .lsb-cursor, .lsb-cursor-move { animation: none; }
}`;

const BRAND_FILL = 'fill-brand-500 dark:fill-brand-400';
const BRAND_STROKE = 'stroke-brand-500 dark:stroke-brand-400';

const TEXT = {
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontSize: 10,
} as const;

function Cell({
  id,
  r,
  value,
  color,
  strong = false,
}: {
  id: string;
  r: number;
  value: number;
  color: string;
  strong?: boolean;
}) {
  const y = rowY(r);
  return (
    <g>
      <rect
        // The total's in the brand ink, as the cursor is; a value's in its bar's colour.
        className={`lsb-ring lsb-${id}-ring ${strong ? BRAND_STROKE : ''}`}
        x={colX(1) + 0.75}
        y={y + 0.75}
        width={COLS[1]! - 1.5}
        height={ROW - 1.5}
        rx={2}
        fill="none"
        stroke={strong ? undefined : color}
        strokeWidth={1.5}
      />
      <text
        className={`lsb-value lsb-${id} ${strong ? BRAND_FILL : ''}`}
        x={colX(2) - 8}
        y={y + 15.5}
        textAnchor="end"
        fontWeight={strong ? 700 : 500}
        {...TEXT}
        style={strong ? undefined : { fill: 'currentColor' }}
      >
        {value}
      </text>
      <rect
        className={`lsb-bar lsb-${id}-bar`}
        x={colX(2) + 8}
        y={y + 8}
        width={value * BAR_SCALE}
        height={8}
        rx={4}
        fill={color}
        fillOpacity={strong ? 1 : 0.85}
      />
    </g>
  );
}

export function SheetBuildAnimation({ className = 'max-w-[240px]' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLoopPhase(ref, 'sheet', DURATION_MS, '--lsb-delay');
  const height = HEAD + ROWS * ROW;
  return (
    <div ref={ref} className={`mx-auto w-full text-slate-700 dark:text-slate-200 ${className}`}>
      <svg
        viewBox="0 0 300 180"
        className="w-full overflow-visible"
        role="img"
        aria-label="Filling in a sheet"
      >
        <defs>
          <linearGradient id="lsb-total" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0ea5e9" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <g className="lsb-card">
          <rect
            x={X0}
            y={Y0}
            width={WIDTH}
            height={height}
            rx={10}
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
            strokeWidth={1}
          />
        </g>
        {/* Headers: the band across the top and the gutter down the left. */}
        <path
          d={`M ${X0 + 10} ${Y0} H ${X0 + WIDTH - 10} A 10 10 0 0 1 ${X0 + WIDTH} ${Y0 + 10} V ${Y0 + HEAD} H ${X0} V ${Y0 + 10} A 10 10 0 0 1 ${X0 + 10} ${Y0} Z`}
          className="fill-slate-50 dark:fill-slate-900/60"
        />
        <path
          d={`M ${X0} ${Y0 + HEAD} H ${X0 + GUTTER} V ${Y0 + height - 10} A 10 10 0 0 1 ${X0 + GUTTER - 12} ${Y0 + height} H ${X0 + 10} A 10 10 0 0 1 ${X0} ${Y0 + height - 10} Z`}
          className="fill-slate-50 dark:fill-slate-900/60"
        />
        {/* Gridlines. */}
        <g className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1}>
          {Array.from({ length: ROWS }, (_, r) => (
            <path key={`h${r}`} d={`M ${X0} ${rowY(r)} H ${X0 + WIDTH}`} />
          ))}
          {[0, 1, 2].map((c) => (
            <path key={`v${c}`} d={`M ${colX(c)} ${Y0} V ${Y0 + height}`} />
          ))}
        </g>
        <g {...TEXT} fontSize={8} fontWeight={600} className="fill-slate-400 dark:fill-slate-500">
          {['A', 'B', 'C'].map((l, c) => (
            <text key={l} x={colX(c) + COLS[c]! / 2} y={Y0 + 14.5} textAnchor="middle">
              {l}
            </text>
          ))}
          {Array.from({ length: ROWS }, (_, r) => (
            <text key={r} x={X0 + GUTTER / 2} y={rowY(r) + 15} textAnchor="middle">
              {r + 1}
            </text>
          ))}
        </g>
        {/* The labels are there from the start; the numbers are what gets typed. */}
        <g {...TEXT} className="fill-slate-500 dark:fill-slate-400">
          {ROWS_DATA.map((row, r) => (
            <text key={row.id} x={colX(0) + 8} y={rowY(r) + 15.5}>
              {row.label}
            </text>
          ))}
          <text
            x={colX(0) + 8}
            y={rowY(3) + 15.5}
            fontWeight={700}
            className="fill-slate-700 dark:fill-slate-200"
          >
            Total
          </text>
        </g>
        {/* The column the drag picks, under its values. */}
        <rect
          className={`lsb-range ${BRAND_FILL} ${BRAND_STROKE}`}
          x={colX(1)}
          y={rowY(0)}
          width={COLS[1]}
          height={ROW * 3}
          fillOpacity={0.1}
          strokeOpacity={0.6}
          strokeWidth={1.25}
        />
        {ROWS_DATA.map((row, r) => (
          <Cell key={row.id} id={row.id} r={r} value={row.value} color={row.color} />
        ))}
        <Cell id="total" r={3} value={TOTAL} color="url(#lsb-total)" strong />
        <BuildCursor moveClass="lsb-cursor-move" fadeClass="lsb-cursor" />
      </svg>
      <style>{CSS}</style>
    </div>
  );
}
