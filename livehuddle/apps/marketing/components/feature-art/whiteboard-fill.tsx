// Feature art for the Whiteboard category's Fill tool (docs/specs/019-marketing/marketing-site.md,
// docs/specs/023-draw-mode/fill-tool.md): a marker loop and a drawn box, each filled with one press
// of the paint bucket, its ink kept as the outline, and the dock's Fill button with the colour in
// hand under its bucket. Whole at rest; the fa-f-* loops (app/feature-art/modes.css) carry the
// bucket in and pour each fill.

import { at, Stage, SURFACE } from './mode-parts';

const GREEN = '#10b981';
const AMBER = '#f59e0b';
// Ink is the canvas's text colour: near-black on a light board, near-white on a dark one.
const INK_STROKE = 'stroke-(--art-text)';

const LOOP =
  'M34 52 C 30 30, 54 16, 80 18 C 106 20, 122 36, 116 56 C 110 76, 82 84, 60 78 C 44 74, 34 66, 35 54';
const LOOP_FILL =
  'M34 52 C 30 30, 54 16, 80 18 C 106 20, 122 36, 116 56 C 110 76, 82 84, 60 78 C 44 74, 34 66, 34 52 Z';

// The paint bucket, with the bar of the colour it pours under it.
function Bucket({ bar }: { bar: string }) {
  return (
    <g>
      <path
        className="stroke-slate-600 dark:stroke-slate-200"
        d="M-6 -2 l5 -5 l6 6 l-5 5 Z M-1 -7 l-2 -2"
        fill="none"
        stroke="#475569"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        className="fill-slate-600 dark:fill-slate-200"
        d="M6 0 c1.6 2.2 1.6 3.6 0 3.6 s-1.6 -1.4 0 -3.6 Z"
        fill="#475569"
      />
      <rect x="-7" y="6" width="14" height="3" rx="1.5" fill={bar} />
    </g>
  );
}

/** The Fill tool: a press inside a marker loop or a box fills it, under its ink. */
export function FillArt() {
  return (
    <Stage>
      {/* A marker loop whose ends meet: the fill pours in under the ink. */}
      <path className="fa-f-in" style={at(0.9)} d={LOOP_FILL} fill={GREEN} fillOpacity="0.45" />
      <path
        className={INK_STROKE}
        d={LOOP}
        fill="none"
        stroke="#1c1917"
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      {/* A drawn box: the same press fills a shape. */}
      <rect
        className="fa-f-in"
        style={at(1.9)}
        x="142"
        y="26"
        width="74"
        height="48"
        rx="4"
        fill={AMBER}
        fillOpacity="0.5"
      />
      <rect
        className={INK_STROKE}
        x="142"
        y="26"
        width="74"
        height="48"
        rx="4"
        fill="none"
        stroke="#1c1917"
        strokeWidth="2"
      />

      {/* The bucket, carried in to the loop. */}
      <g className="fa-f-carry" style={at(0, { '--fx': '70px', '--fy': '-6px' })}>
        <g transform="translate(78 50)">
          <path
            className="stroke-slate-800 dark:stroke-slate-100"
            d="M-5 0 h10 M0 -5 v10"
            stroke="#1e293b"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <g transform="translate(13 -11)">
            <rect className={SURFACE} x="-10" y="-11" width="22" height="24" rx="5" fill="#fff" />
            <Bucket bar={GREEN} />
          </g>
        </g>
      </g>

      {/* The dock's Fill button, the colour in hand under its bucket, its key in the corner. */}
      <g transform="translate(240 30)">
        <rect
          className="fill-brand-100 stroke-brand-300 dark:fill-brand-900/60 dark:stroke-brand-700"
          width="36"
          height="36"
          rx="8"
          fill="#e0e7ff"
          stroke="#a5b4fc"
        />
        <g transform="translate(17 17)">
          <Bucket bar={GREEN} />
        </g>
        <text
          className="fill-slate-500 dark:fill-slate-400"
          x="32"
          y="9"
          textAnchor="end"
          fontSize="8"
          fontWeight="600"
          fill="#64748b"
        >
          F
        </text>
      </g>
    </Stage>
  );
}
