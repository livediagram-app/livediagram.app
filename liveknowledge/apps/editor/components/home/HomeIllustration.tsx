// The Knowledgebase Home's illustration (docs/specs/030-knowledgebase/knowledgebase-home.md "Hero"): the five other
// apps as small cubes standing on a lime platform, each feeding one large lime cube (the knowledgebase: writing on
// one face, a tick on the other), which a person asking a question and an agent giving a cited answer both read.
// Drawn here as one inline SVG, 560 by 400, in a 2:1 isometric: a step along the platform's right edge is (+2, +1),
// along its left edge (-2, +1), and up is (0, -1). Flat fills only. Lime is the brand ramp and the cards' paper and
// ink are the theme's slate, so it follows light and dark. Decorative: one image with one label.
import type { ReactNode } from 'react';

type Shades = { top: string; left: string; right: string };

// A cube standing on (cx, cy), the centre of its base: its top, left and right faces.
function Cube({
  cx,
  cy,
  half,
  height,
  shades,
  children,
}: {
  cx: number;
  cy: number;
  // Half the width on screen; the base's diamond is `half` wide each way and `half / 2` tall each way.
  half: number;
  height: number;
  shades: Shades;
  children?: ReactNode;
}) {
  const rise = half / 2;
  const top = cy - height;
  return (
    <g>
      <polygon
        className={shades.left}
        points={`${cx - half},${top} ${cx},${top + rise} ${cx},${cy + rise} ${cx - half},${cy}`}
      />
      <polygon
        className={shades.right}
        points={`${cx},${top + rise} ${cx + half},${top} ${cx + half},${cy} ${cx},${cy + rise}`}
      />
      <polygon
        className={shades.top}
        points={`${cx},${top - rise} ${cx + half},${top} ${cx},${top + rise} ${cx - half},${top}`}
      />
      {children}
    </g>
  );
}

// The five other apps, each in its own colour: light on top, mid at the left, dark at the right.
const APPS: readonly { cx: number; cy: number; shades: Shades }[] = [
  // Back row first, so nearer cubes are drawn over farther ones.
  {
    cx: 190,
    cy: 218,
    shades: { top: 'fill-violet-300', left: 'fill-violet-500', right: 'fill-violet-700' },
  },
  {
    cx: 370,
    cy: 218,
    shades: { top: 'fill-amber-300', left: 'fill-amber-500', right: 'fill-amber-700' },
  },
  {
    cx: 112,
    cy: 268,
    shades: { top: 'fill-sky-300', left: 'fill-sky-500', right: 'fill-sky-700' },
  },
  {
    cx: 448,
    cy: 268,
    shades: { top: 'fill-rose-300', left: 'fill-rose-500', right: 'fill-rose-700' },
  },
  {
    cx: 280,
    cy: 346,
    shades: { top: 'fill-emerald-300', left: 'fill-emerald-500', right: 'fill-emerald-700' },
  },
];

// Where the knowledgebase's cube stands, and its size.
const CORE = { cx: 280, cy: 274, half: 62, height: 78 };
// The owner's three limes: #bef264 on top, #65a30d at the left, #3f6212 at the right. The top and the right are the
// brand ramp's 300 and 700; the left sits between its 500 and 600, so it is written out.
const LIME: Shades = { top: 'fill-brand-300', left: 'fill-[#65a30d]', right: 'fill-brand-700' };

const INK = 'stroke-slate-900 dark:stroke-slate-100';
const PAPER = 'fill-white dark:fill-slate-800';
const BAR = 'fill-slate-300 dark:fill-slate-600';
const BAR_SOFT = 'fill-slate-200 dark:fill-slate-700';
const DOT = 'fill-brand-400 dark:fill-brand-300';

// A card with a lime shadow set off down and right, and a dark outline.
function Card({
  x,
  y,
  width,
  height,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <g>
      <rect x={x + 7} y={y + 7} width={width} height={height} rx={14} className="fill-brand-400" />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={14}
        strokeWidth={2.5}
        className={`${PAPER} ${INK}`}
      />
      {children}
    </g>
  );
}

export function HomeIllustration({ className = '' }: { className?: string }) {
  const coreTop = CORE.cy - CORE.height;
  return (
    <svg
      role="img"
      aria-label="The five other apps as small cubes feeding one large lime cube of knowledge, read by a person asking a question and an agent giving a cited answer."
      viewBox="0 0 560 400"
      className={className}
      data-home-illustration=""
    >
      <g aria-hidden="true">
        {/* The platform: a lime diamond with an edge, and a dashed ring inside it. */}
        <polygon
          points="50,268 280,383 280,397 50,282"
          className="fill-brand-400 dark:fill-brand-600"
        />
        <polygon
          points="510,268 280,383 280,397 510,282"
          className="fill-brand-500 dark:fill-brand-700"
        />
        <polygon
          points="280,153 510,268 280,383 50,268"
          className="fill-brand-200 dark:fill-brand-900"
        />
        <polygon
          points="280,185 446,268 280,351 114,268"
          fill="none"
          strokeWidth={2}
          strokeDasharray="7 7"
          strokeLinecap="round"
          className="stroke-brand-500 dark:stroke-brand-500"
        />

        {/* Each app's connector, along the platform, to the foot of the knowledgebase's cube. */}
        {APPS.map(({ cx, cy }) => (
          <line
            key={`${cx}-${cy}`}
            x1={cx}
            y1={cy}
            x2={CORE.cx}
            y2={CORE.cy}
            strokeWidth={2.5}
            strokeDasharray="2 7"
            strokeLinecap="round"
            className="stroke-brand-600 dark:stroke-brand-300"
          />
        ))}

        {APPS.slice(0, 4).map(({ cx, cy, shades }) => (
          <Cube key={`${cx}-${cy}`} cx={cx} cy={cy} half={22} height={26} shades={shades} />
        ))}

        {/* The knowledgebase: three lines of writing on its left face, a tick on its right. */}
        <Cube {...CORE} shades={LIME}>
          <g
            transform={`matrix(1 0.5 0 1 ${CORE.cx - CORE.half} ${coreTop})`}
            strokeWidth={6}
            strokeLinecap="round"
            className="stroke-white/90"
          >
            <path d="M13 22 H49 M13 39 H49 M13 56 H35" fill="none" />
          </g>
          <g
            transform={`matrix(1 -0.5 0 1 ${CORE.cx} ${coreTop + CORE.half / 2})`}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-brand-200"
          >
            <path d="M15 40 L27 53 L48 25" fill="none" />
          </g>
        </Cube>

        {APPS.slice(4).map(({ cx, cy, shades }) => (
          <Cube key={`${cx}-${cy}`} cx={cx} cy={cy} half={22} height={26} shades={shades} />
        ))}

        {/* Each reader's dotted line to the cube. */}
        <g
          fill="none"
          strokeWidth={3}
          strokeDasharray="0.1 8"
          strokeLinecap="round"
          className="stroke-slate-500 dark:stroke-slate-400"
        >
          <path d="M132 118 C 132 162, 214 146, 254 182" />
          <path d="M432 126 C 432 166, 348 148, 306 182" />
        </g>

        {/* A person's question. */}
        <Card x={34} y={26} width={196} height={84}>
          <circle cx={68} cy={68} r={17} strokeWidth={2.5} className={`fill-sky-300 ${INK}`} />
          <circle cx={68} cy={63} r={5.5} className="fill-slate-900" />
          <path d="M57 80 a11 9 0 0 1 22 0" className="fill-slate-900" />
          <rect x={98} y={52} width={74} height={9} rx={4.5} className={BAR} />
          <rect x={98} y={70} width={48} height={9} rx={4.5} className={BAR_SOFT} />
          <text
            x={202}
            y={81}
            textAnchor="middle"
            fontSize={36}
            fontWeight={800}
            className="fill-brand-600 dark:fill-brand-300"
          >
            ?
          </text>
        </Card>

        {/* An agent's cited answer. */}
        <Card x={326} y={14} width={204} height={104}>
          <rect
            x={342}
            y={30}
            width={34}
            height={34}
            rx={9}
            className="fill-slate-900 dark:fill-slate-950"
          />
          <path d="M359 30 v-7" strokeWidth={2.5} strokeLinecap="round" className={INK} />
          <circle cx={359} cy={21} r={3} className="fill-brand-400" />
          <circle cx={352} cy={45} r={3.5} className="fill-brand-300" />
          <circle cx={366} cy={45} r={3.5} className="fill-brand-300" />
          <path
            d="M352 55 h14"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-brand-300"
          />
          <rect x={388} y={34} width={124} height={9} rx={4.5} className={BAR} />
          <rect x={388} y={52} width={92} height={9} rx={4.5} className={BAR_SOFT} />
          <rect x={342} y={76} width={108} height={9} rx={4.5} className={BAR_SOFT} />
          <rect
            x={342}
            y={94}
            width={18}
            height={15}
            rx={4.5}
            className="fill-brand-200 dark:fill-brand-800"
          />
          <rect
            x={365}
            y={94}
            width={18}
            height={15}
            rx={4.5}
            className="fill-brand-200 dark:fill-brand-800"
          />
          <circle cx={505} cy={93} r={13} className="fill-emerald-500" />
          <path
            d="M498.5 93.5 l4.5 4.5 l8.5 -9.5"
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-white"
          />
        </Card>

        {/* A few lime dots. */}
        <circle cx={280} cy={62} r={5} className={DOT} />
        <circle cx={262} cy={124} r={3} className={DOT} />
        <circle cx={300} cy={136} r={3.5} className={DOT} />
        <circle cx={30} cy={178} r={4} className={DOT} />
        <circle cx={532} cy={186} r={3.5} className={DOT} />
        <circle cx={76} cy={148} r={2.5} className={DOT} />
        <circle cx={486} cy={156} r={2.5} className={DOT} />
      </g>
    </svg>
  );
}
