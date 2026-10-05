import type { CSSProperties, ReactNode } from 'react';
import { cursorRide, type Point } from '@/lib/hero-motion';

// The hero's Diagram window (docs/specs/019-marketing/marketing-site.md "Hero"): two people map a
// sign-up flow together in Diagram mode. Inside a frame, you drop three steps from the strip (each
// label typed as it lands) and they join up with arrows; a teammate adds the "No" branch and a
// Retry loop back; you add the "Yes" step slightly off, drag it, and it snaps onto the pink
// alignment guide; you select it and pick green from the colour row; the teammate leaves a sticky
// question and wires a database in with a dashed connector. Every shape is in the Default theme's
// ink (the --art-* palette), so it looks as the editor draws it. Each piece arrives at its own --d
// delay and the two cursors ride CSS motion paths timed to the drops (hero-mode-animations.css).

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const LABEL = 'fill-(--art-ink-text)';
const ARROW = 'stroke-(--art-arrow)';
const YOU = '#0ea5e9';
const TEAMMATE = '#ec4899';

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

// A label typed out over `dur` seconds once its shape lands.
function Typed({
  x,
  y,
  d,
  children,
  size = 13,
}: {
  x: number;
  y: number;
  d: number;
  children: string;
  size?: number;
}) {
  return (
    <text
      className={`hm-type ${LABEL}`}
      style={at(d, { '--steps': children.length })}
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily={FONT}
      fontSize={size}
      fontWeight="600"
      stroke="none"
    >
      {children}
    </text>
  );
}

// A connector that draws on, its head last, with an optional label on a canvas-coloured chip.
function Connector({
  d: path,
  at: start,
  len,
  dashed = false,
  label,
}: {
  d: string;
  at: number;
  len: number;
  dashed?: boolean;
  label?: { x: number; y: number; text: string };
}) {
  return (
    <g>
      <path
        className={`${dashed ? 'hm-fade' : 'hm-draw'} ${ARROW}`}
        style={at(start, { '--dur': '0.45s', '--len': len })}
        d={path}
        fill="none"
        strokeWidth="2"
        strokeDasharray={dashed ? '6 5' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {label ? (
        <g className="hm-pop" style={at(start + 0.35)}>
          <rect
            x={label.x - (label.text.length * 6 + 10) / 2}
            y={label.y - 10}
            width={label.text.length * 6 + 10}
            height="15"
            rx="4"
            className="fill-(--art-paper)"
          />
          <text
            x={label.x}
            y={label.y + 1}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="10"
            fontWeight="600"
            className="fill-(--art-arrow-label)"
          >
            {label.text}
          </text>
        </g>
      ) : null}
    </g>
  );
}

// A shape that lands with a small overshoot.
function Drop({ d, children }: { d: number; children: ReactNode }) {
  return (
    <g className="hm-pop" style={at(d)}>
      {children}
    </g>
  );
}

function Cursor({
  className,
  color,
  name,
  ride,
}: {
  className: string;
  color: string;
  name: string;
  ride: readonly Point[];
}) {
  return (
    <g className={className} style={cursorRide(ride) as CSSProperties} aria-hidden>
      <path
        d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
      />
      <rect x="10" y="12" width="22" height="13" rx="3" fill={color} />
      <text
        x="21"
        y="21.5"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="8"
        fontWeight="700"
        fill="white"
      >
        {name}
      </text>
    </g>
  );
}

const SWATCHES = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'];

type Box = { cx: number; cy: number; w: number; h: number };
type Link = { d: string; len: number; label?: { x: number; y: number; text: string } };

// Where everything sits: the wide window's landscape layout, and a phone's portrait one, where the
// flow runs down the screen (the Yes step beside the decision, the No step below it).
type Layout = {
  frame: { x: number; y: number; w: number; h: number };
  visit: Box;
  create: Box;
  verified: { cx: number; cy: number; hw: number; hh: number };
  reminder: Box;
  tour: Box;
  db: { cx: number; top: number; w: number };
  sticky: { x: number; y: number };
  guide: { x1: number; x2: number; y: number };
  links: {
    visitCreate: Link;
    createVerified: Link;
    no: Link;
    retry: Link;
    yes: Link;
    writes: Link;
  };
  you: Point[];
  teammate: Point[];
};

const LANDSCAPE: Layout = {
  frame: { x: 20, y: -44, w: 560, h: 340 },
  visit: { cx: 110, cy: 32, w: 120, h: 44 },
  create: { cx: 110, cy: 135, w: 120, h: 50 },
  verified: { cx: 290, cy: 135, hw: 70, hh: 40 },
  reminder: { cx: 290, cy: 255, w: 130, h: 50 },
  tour: { cx: 475, cy: 135, w: 130, h: 50 },
  db: { cx: 475, top: 228, w: 110 },
  sticky: { x: 410, y: -31 },
  guide: { x1: 40, x2: 565, y: 135 },
  links: {
    visitCreate: { d: 'M110 54 L110 110 M104 103 L110 110 L116 103', len: 70 },
    createVerified: { d: 'M170 135 L220 135 M213 129 L220 135 L213 141', len: 60 },
    no: {
      d: 'M290 175 L290 230 M284 223 L290 230 L296 223',
      len: 70,
      label: { x: 290, y: 205, text: 'No' },
    },
    retry: {
      d: 'M225 255 L110 255 L110 160 M104 167 L110 160 L116 167',
      len: 230,
      label: { x: 160, y: 255, text: 'Retry' },
    },
    yes: {
      d: 'M360 135 L410 135 M403 129 L410 135 L403 141',
      len: 60,
      label: { x: 384, y: 126, text: 'Yes' },
    },
    writes: {
      d: 'M475 166 L475 218 M469 211 L475 218 L481 211',
      len: 60,
      label: { x: 498, y: 195, text: 'writes' },
    },
  },
  you: [
    [330, -40],
    [110, 32],
    [110, 135],
    [290, 135],
    [475, 150],
    [475, 137],
    [480, 86],
  ],
  teammate: [
    [620, 300],
    [290, 255],
    [170, 255],
    [470, 15],
    [545, 268],
  ],
};

const PORTRAIT: Layout = {
  frame: { x: 8, y: -32, w: 344, h: 432 },
  visit: { cx: 110, cy: 22, w: 120, h: 44 },
  create: { cx: 110, cy: 115, w: 120, h: 50 },
  verified: { cx: 110, cy: 215, hw: 60, hh: 36 },
  reminder: { cx: 110, cy: 322, w: 130, h: 50 },
  tour: { cx: 268, cy: 215, w: 130, h: 50 },
  db: { cx: 268, top: 300, w: 110 },
  sticky: { x: 208, y: -22 },
  guide: { x1: 16, x2: 344, y: 215 },
  links: {
    visitCreate: { d: 'M110 44 L110 90 M104 83 L110 90 L116 83', len: 60 },
    createVerified: { d: 'M110 140 L110 179 M104 172 L110 179 L116 172', len: 50 },
    no: {
      d: 'M110 251 L110 297 M104 290 L110 297 L116 290',
      len: 60,
      label: { x: 110, y: 277, text: 'No' },
    },
    retry: {
      d: 'M45 322 L24 322 L24 115 L50 115 M43 109 L50 115 L43 121',
      len: 260,
      label: { x: 24, y: 222, text: 'Retry' },
    },
    yes: {
      d: 'M170 215 L203 215 M196 209 L203 215 L196 221',
      len: 45,
      label: { x: 187, y: 205, text: 'Yes' },
    },
    writes: {
      d: 'M268 240 L268 290 M262 283 L268 290 L274 283',
      len: 60,
      label: { x: 292, y: 266, text: 'writes' },
    },
  },
  you: [
    [300, -38],
    [110, 22],
    [110, 115],
    [110, 215],
    [268, 230],
    [268, 217],
    [272, 151],
  ],
  teammate: [
    [350, 470],
    [110, 322],
    [40, 322],
    [266, 10],
    [334, 330],
  ],
};

function Rect({ box, round }: { box: Box; round?: boolean }) {
  return (
    <rect
      x={box.cx - box.w / 2}
      y={box.cy - box.h / 2}
      width={box.w}
      height={box.h}
      rx={round ? box.h / 2 : 8}
      className={INK}
      strokeWidth="2"
    />
  );
}

export function DiagramBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  const { tour, verified: v } = L;
  const dbBottom = L.db.top + 42;
  const dbLeft = L.db.cx - L.db.w / 2;
  const dbRight = L.db.cx + L.db.w / 2;
  return (
    <>
      {/* The frame the flow lives in, with its name. */}
      <g className="hm-fade" style={at(0.1)}>
        <rect
          x={L.frame.x}
          y={L.frame.y}
          width={L.frame.w}
          height={L.frame.h}
          rx="10"
          fill="none"
          className="stroke-(--art-ink-stroke)"
          strokeWidth="1.5"
          strokeDasharray="6 5"
          opacity="0.6"
        />
        <text
          x={L.frame.x + 14}
          y={L.frame.y + 18}
          fontFamily={FONT}
          fontSize="11"
          fontWeight="700"
          className="fill-(--art-ink-text)"
        >
          Sign-up flow
        </text>
      </g>

      {/* Your three steps: dropped from the strip, labelled as they land. */}
      <Drop d={1.0}>
        <Rect box={L.visit} round />
      </Drop>
      <Typed x={L.visit.cx} y={L.visit.cy + 5} d={1.1}>
        Visit site
      </Typed>
      <Drop d={1.8}>
        <Rect box={L.create} />
      </Drop>
      <Typed x={L.create.cx} y={L.create.cy + 5} d={1.9}>
        Create account
      </Typed>
      <Connector {...L.links.visitCreate} at={2.0} />
      <Drop d={2.6}>
        <polygon
          points={`${v.cx},${v.cy - v.hh} ${v.cx + v.hw},${v.cy} ${v.cx},${v.cy + v.hh} ${v.cx - v.hw},${v.cy}`}
          className={INK}
          strokeWidth="2"
        />
      </Drop>
      <Typed x={v.cx} y={v.cy + 4} d={2.7} size={12}>
        Verified?
      </Typed>
      <Connector {...L.links.createVerified} at={3.2} />

      {/* The teammate's No branch and the Retry loop back. */}
      <Drop d={4.4}>
        <Rect box={L.reminder} />
      </Drop>
      <Typed x={L.reminder.cx} y={L.reminder.cy + 5} d={4.5}>
        Send reminder
      </Typed>
      <Connector {...L.links.no} at={4.8} />
      <Connector {...L.links.retry} at={5.1} />

      {/* Your Yes step lands a little low, is dragged, and snaps onto the guide. */}
      <line
        className="hm-guide"
        x1={L.guide.x1}
        y1={L.guide.y}
        x2={L.guide.x2}
        y2={L.guide.y}
        stroke="#ec4899"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <g className="hm-snap">
        <Drop d={5.0}>
          <rect
            x={tour.cx - tour.w / 2}
            y={tour.cy - tour.h / 2}
            width={tour.w}
            height={tour.h}
            rx="8"
            className={`hm-recolour ${INK}`}
            strokeWidth="2"
          />
        </Drop>
        <Typed x={tour.cx} y={tour.cy + 5} d={5.1}>
          Welcome tour
        </Typed>
        {/* Picked green: done. */}
        <g className="hm-pop" style={at(7.95)}>
          <circle cx={tour.cx + 57} cy={tour.cy - 23} r="8" fill="#16a34a" />
          <path
            d={`M${tour.cx + 53} ${tour.cy - 23} l3 3 l5 -6`}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <Connector {...L.links.yes} at={6.5} />

      {/* You select it: the outline, its handles and the colour row. */}
      <g className="hm-select" style={at(7.0)}>
        <rect
          x={tour.cx - 71}
          y={tour.cy - 31}
          width="142"
          height="62"
          fill="none"
          stroke={YOU}
          strokeWidth="1.5"
        />
        {[
          [tour.cx - 71, tour.cy - 31],
          [tour.cx + 71, tour.cy - 31],
          [tour.cx - 71, tour.cy + 31],
          [tour.cx + 71, tour.cy + 31],
        ].map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx! - 3.5}
            y={hy! - 3.5}
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            stroke={YOU}
            strokeWidth="1.5"
          />
        ))}
        <g className="hm-pop" style={at(7.2)}>
          <rect
            x={tour.cx - 45}
            y={tour.cy - 67}
            width="96"
            height="26"
            rx="7"
            className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          />
          {SWATCHES.map((c, i) => (
            <circle
              key={c}
              cx={tour.cx - 30 + i * 16.5}
              cy={tour.cy - 54}
              r="6"
              fill={c}
              stroke={i === 2 ? '#15803d' : 'none'}
              strokeWidth="2"
            />
          ))}
        </g>
      </g>

      {/* The teammate's sticky question, and the database wired in. */}
      <Drop d={8.4}>
        <g transform={`rotate(2 ${L.sticky.x + 59} ${L.sticky.y + 32})`}>
          <rect
            x={L.sticky.x + 2}
            y={L.sticky.y + 3}
            width="118"
            height="64"
            rx="3"
            fill="#0f172a"
            opacity="0.08"
          />
          <rect x={L.sticky.x} y={L.sticky.y} width="118" height="64" rx="3" fill="#fde68a" />
          <text
            x={L.sticky.x + 12}
            y={L.sticky.y + 23}
            fontFamily={FONT}
            fontSize="11"
            fontWeight="600"
            fill="#1c1917"
          >
            Add SSO here
          </text>
          <text
            x={L.sticky.x + 12}
            y={L.sticky.y + 39}
            fontFamily={FONT}
            fontSize="11"
            fontWeight="600"
            fill="#1c1917"
          >
            later? – JR
          </text>
        </g>
      </Drop>
      <Drop d={9.5}>
        <path
          d={`M${dbLeft} ${L.db.top} L${dbLeft} ${dbBottom} A${L.db.w / 2} 10 0 0 0 ${dbRight} ${dbBottom} L${dbRight} ${L.db.top}`}
          className={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <ellipse
          cx={L.db.cx}
          cy={L.db.top}
          rx={L.db.w / 2}
          ry="10"
          className={INK}
          strokeWidth="2"
        />
      </Drop>
      <Typed x={L.db.cx} y={L.db.top + 30} d={9.6}>
        Users DB
      </Typed>
      <Connector {...L.links.writes} at={9.8} dashed />

      {/* The two of you, live. */}
      <Cursor className="hm-you" color={YOU} name="TM" ride={L.you} />
      <Cursor className="hm-teammate" color={TEAMMATE} name="JR" ride={L.teammate} />
    </>
  );
}
