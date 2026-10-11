// Feature art for the Whiteboard category (docs/specs/019-marketing/marketing-site.md,
// docs/specs/023-draw-mode/draw-mode.md): Draw mode's three markers, a pressure-sensitive pen,
// and the two erasers (the Path tool and palm rejection are in ./whiteboard-pen). Each is a finished little board at rest;
// the fa-f-* loops only draw the strokes on and move the hands (mode-parts.tsx).

import { at, Cursor, INK, MUTED, Pill, Stage, TEAMMATE, ToolStrip, YOU } from './mode-parts';

const PINK = '#ec4899';
const GREEN = '#10b981';
const STICKY_YELLOW = '#fde68a';
const STICKY_BLUE = '#bfdbfe';
const STICKY_INK = '#422006';
// Ink is the canvas's text colour: near-black on a light board, near-white on a dark one.
const INK_STROKE = 'stroke-(--art-text)';

// A marker as the Draw tools show it: a slanted body with its colour at the tip.
function MarkerGlyph({
  x,
  y,
  colour,
  ink = false,
}: {
  x: number;
  y: number;
  colour: string;
  ink?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        className="fill-slate-500 dark:fill-slate-300"
        d="M-3.2 2.2 L2.4 -3.4 Q3.4 -4.4 4.4 -3.4 L4.8 -3 Q5.8 -2 4.8 -1 L-0.8 4.6 Z"
        fill="#64748b"
      />
      <path
        className={ink ? 'fill-(--art-text)' : undefined}
        d="M-3.2 2.2 L-0.8 4.6 L-4.6 5.9 Z"
        fill={ink ? '#1c1917' : colour}
      />
      <path
        className={ink ? 'stroke-(--art-text)' : undefined}
        d="M-2.4 1.4 L0 3.8"
        stroke={ink ? '#1c1917' : colour}
        strokeWidth="1.3"
      />
    </g>
  );
}

// A sticky note: square paper in its own colour, in either appearance, with two lines on it.
function Sticky({
  x,
  y,
  fill,
  lines,
  tilt = 0,
}: {
  x: number;
  y: number;
  fill: string;
  lines: [string, string];
  tilt?: number;
}) {
  return (
    <g transform={`rotate(${tilt} ${x + 19} ${y + 17})`}>
      <rect
        x={x}
        y={y}
        width="38"
        height="34"
        rx="1.5"
        fill={fill}
        className="drop-shadow-[0_1.5px_1.5px_rgb(15_23_42/0.18)]"
      />
      <text x={x + 5} y={y + 14} fontSize="7" fontWeight="700" fill={STICKY_INK}>
        {lines[0]}
      </text>
      <text x={x + 5} y={y + 23} fontSize="7" fontWeight="700" fill={STICKY_INK}>
        {lines[1]}
      </text>
    </g>
  );
}

/** The three markers in hand (keys 1, 2, 3), each leaving its own mark on a retro board. */
export function MarkersArt() {
  const markers = [
    { colour: '#1c1917', ink: true, key: '1' },
    { colour: PINK, ink: false, key: '2' },
    { colour: GREEN, ink: false, key: '3' },
  ];
  return (
    <Stage>
      {/* The Draw tools: the three markers (Marker 2 in hand) and the width: Fine, Medium, Bold. */}
      <ToolStrip x={92} y={4} w={116}>
        {markers.map((m, i) => (
          <g key={m.key}>
            {i === 1 ? (
              <rect
                className="fill-sky-100 dark:fill-sky-500/25"
                x={96 + i * 20}
                y={6}
                width="18"
                height="11"
                rx="2.5"
                fill="#e0f2fe"
              />
            ) : null}
            <MarkerGlyph x={105 + i * 20} y={11.5} colour={m.colour} ink={m.ink} />
            <text
              className={MUTED}
              x={112 + i * 20}
              y={15.6}
              fontSize="4.8"
              fontWeight="700"
              fill="#64748b"
            >
              {m.key}
            </text>
          </g>
        ))}
        <path
          className="stroke-slate-200 dark:stroke-slate-600"
          d="M158 7.5 V15.5"
          stroke="#e2e8f0"
        />
        {[1.1, 1.9, 2.8].map((r, i) => (
          <g key={r}>
            {i === 1 ? (
              <circle
                className="fill-sky-100 dark:fill-sky-500/25"
                cx={173 + i * 12}
                cy={11.5}
                r="5"
                fill="#e0f2fe"
              />
            ) : null}
            <circle
              className="fill-slate-600 dark:fill-slate-200"
              cx={173 + i * 12}
              cy={11.5}
              r={r}
              fill="#475569"
            />
          </g>
        ))}
      </ToolStrip>

      {/* Marker 1, Ink, Fine: the heading's underline and an arrow. */}
      <text className={INK} x={30} y={44} fontSize="10" fontWeight="800" fill="#1e293b">
        Launch ideas
      </text>
      <path
        className={`fa-f-draw ${INK_STROKE}`}
        pathLength={1}
        d="M29 49 C 50 47.5, 76 50, 98 47.6"
        fill="none"
        stroke="#1c1917"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        className={`fa-f-draw ${INK_STROKE}`}
        style={at(0.4)}
        pathLength={1}
        d="M58 60 C 62 74, 84 80, 112 70 M106 66 L113 69.6 L107.6 75"
        fill="none"
        stroke="#1c1917"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Sticky x={124} y={34} fill={STICKY_YELLOW} lines={['Beta', 'first']} tilt={-3} />
      <Sticky x={196} y={44} fill={STICKY_BLUE} lines={['Ship on', 'Friday']} tilt={3} />

      {/* Marker 2, pink, Medium: a teammate rings the best idea. */}
      <path
        className="fa-f-draw"
        style={at(0.9)}
        pathLength={1}
        d="M150 30 C 128 28, 114 44, 120 62 C 126 78, 160 80, 170 64 C 178 50, 172 32, 146 31"
        fill="none"
        stroke={PINK}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <g transform="translate(173 58)">
        <g className="fa-f-in" style={at(1.6)}>
          <Cursor colour={TEAMMATE} name="JR" />
        </g>
      </g>

      {/* Marker 3, green, Bold: a tick on the one already agreed. */}
      <path
        className="fa-f-draw"
        style={at(1.8)}
        pathLength={1}
        d="M246 60 L253 68 L268 48"
        fill="none"
        stroke={GREEN}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Stage>
  );
}

// The stroke a stylus lays: its centre line and its half-width at each step, thin where the pen
// touched down and lifted, broad where it pressed hardest.
const PRESSURE_STEPS = 48;
const pressureAt = (t: number) =>
  0.5 + 6.2 * Math.pow(Math.sin(Math.PI * t), 1.6) * (0.75 + 0.25 * Math.sin(5 * t));
const centreAt = (t: number): [number, number] => [
  34 + 206 * t,
  44 - 12 * Math.sin(Math.PI * 1.6 * t) + 6 * t,
];

function pressureOutline(): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= PRESSURE_STEPS; i++) {
    const t = i / PRESSURE_STEPS;
    const [x, y] = centreAt(t);
    const w = pressureAt(t);
    top.push(`${x.toFixed(1)} ${(y - w).toFixed(1)}`);
    bottom.unshift(`${x.toFixed(1)} ${(y + w * 0.8).toFixed(1)}`);
  }
  return `M${top.join(' L')} L${bottom.join(' L')} Z`;
}

function pressureGraph(): string {
  const pts: string[] = [];
  for (let i = 0; i <= PRESSURE_STEPS; i++) {
    const t = i / PRESSURE_STEPS;
    pts.push(`${(34 + 206 * t).toFixed(1)} ${(88 - pressureAt(t) * 1.7).toFixed(1)}`);
  }
  return `M34 88 L${pts.join(' L')} L240 88 Z`;
}

const PRESSURE_STROKE = pressureOutline();
const PRESSURE_GRAPH = pressureGraph();
const [PEN_X, PEN_Y] = centreAt(1);

/** A stylus stroke that swells where the pen presses and thins as it lifts, its pressure traced below. */
export function PressureArt() {
  return (
    <Stage>
      <defs>
        <mask id="fa-f-pressure-reveal" maskUnits="userSpaceOnUse">
          <rect className="fa-f-grow-x" x="30" y="0" width="214" height="96" fill="#fff" />
        </mask>
        <linearGradient id="fa-f-pressure-pen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#475569" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <g mask="url(#fa-f-pressure-reveal)">
        <path className="fill-(--art-text)" d={PRESSURE_STROKE} fill="#1c1917" />
        <path
          className="fill-sky-100 stroke-sky-400 dark:fill-sky-500/20 dark:stroke-sky-400"
          d={PRESSURE_GRAPH}
          fill="#e0f2fe"
          stroke="#38bdf8"
          strokeWidth="0.8"
        />
      </g>
      <path
        className="stroke-slate-300 dark:stroke-slate-600"
        d="M30 88.4 H244"
        stroke="#cbd5e1"
        strokeWidth="0.8"
      />
      <text className={MUTED} x={30} y={70} fontSize="6" fontWeight="600" fill="#64748b">
        Pressure
      </text>

      {/* The stylus, its nib on the end of the stroke. */}
      <g transform={`translate(${PEN_X} ${PEN_Y}) rotate(-38)`}>
        <path d="M0 0 L3 -7 L-3 -7 Z" fill="#94a3b8" />
        <path d="M0 0 L1 -2.4 L-1 -2.4 Z" fill="#0f172a" />
        <rect x="-3.6" y="-46" width="7.2" height="39.5" rx="3" fill="url(#fa-f-pressure-pen)" />
        <rect x="-3.6" y="-15" width="7.2" height="2" fill={YOU} />
      </g>

      <g className="fa-f-in" style={at(1.4)}>
        <Pill x={250} y={10} text="Stylus" tone="brand" />
      </g>
    </Stage>
  );
}

// The eraser as the canvas shows it under the pointer: a ring the size it rubs, with its glyph.
function EraserCursor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        className="fill-white/70 stroke-slate-500 dark:fill-slate-900/60 dark:stroke-slate-300"
        r="7"
        fill="#ffffffb3"
        stroke="#64748b"
        strokeWidth="1"
      />
      <g transform="rotate(-35)">
        <rect x="-4" y="-2.4" width="8" height="4.8" rx="1.2" fill="#fda4af" />
        <rect
          x="-4"
          y="-2.4"
          width="3"
          height="4.8"
          rx="1"
          className="fill-white dark:fill-slate-200"
          fill="#fff"
        />
      </g>
    </g>
  );
}

/** The two erasers: the stroke eraser lifts a whole scribble, the partial one rubs out a gap. */
export function ErasersArt() {
  return (
    <Stage>
      <path
        className="stroke-slate-200 dark:stroke-slate-700"
        d="M150 10 V86"
        stroke="#e2e8f0"
        strokeDasharray="2 3"
      />

      {/* Stroke eraser: one touch takes the whole scribble; the sticky beside it is untouched. */}
      <Pill x={12} y={8} text="Stroke" tone="neutral" />
      <Sticky x={86} y={40} fill={STICKY_YELLOW} lines={['Keep', 'this']} tilt={2} />
      <path
        className="stroke-slate-300 dark:stroke-slate-600"
        d="M18 66 C 22 46, 36 44, 40 58 S 54 78, 60 56 S 74 40, 80 60"
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="1"
        strokeDasharray="2 2.6"
      />
      <path
        className="fa-f-out"
        d="M18 66 C 22 46, 36 44, 40 58 S 54 78, 60 56 S 74 40, 80 60"
        fill="none"
        stroke={PINK}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g className="fa-f-in" style={at(0.3)}>
        <EraserCursor x={60} y={56} />
      </g>

      {/* Partial eraser: only what it passes over goes; the line either side stays. */}
      <Pill x={162} y={8} text="Partial" tone="neutral" />
      <path
        className={INK_STROKE}
        d="M166 60 C 178 48, 192 48, 204 56"
        fill="none"
        stroke="#1c1917"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        className="stroke-slate-300 dark:stroke-slate-600"
        d="M204 56 C 212 62, 222 64, 232 58"
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="1"
        strokeDasharray="2 2.6"
      />
      <path
        className={`fa-f-out ${INK_STROKE}`}
        style={at(0.4)}
        d="M204 56 C 212 62, 222 64, 232 58"
        fill="none"
        stroke="#1c1917"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        className={INK_STROKE}
        d="M232 58 C 244 50, 258 46, 284 52"
        fill="none"
        stroke="#1c1917"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g className="fa-f-carry" style={at(0, { '--fx': '-30px', '--fy': '4px' })}>
        <EraserCursor x={232} y={58} />
      </g>
    </Stage>
  );
}
