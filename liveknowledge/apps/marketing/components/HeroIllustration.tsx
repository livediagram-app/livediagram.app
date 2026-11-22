// The hero's illustration (docs/specs/019-marketing/marketing-site.md "Hero"): the five other apps as small cubes
// on a lime platform, each feeding one large lime cube (the knowledgebase: writing on one face, a tick on the
// other), which a person asking a question and an agent giving a cited, verified answer both read. The
// Knowledgebase Home draws the same picture in the editor (apps/editor/components/home/HomeIllustration.tsx); this
// is the site's own copy, finished with words on the cards and motion, until the two share one drawing.
//
// One inline SVG, 600 by 500, in a 2:1 isometric: a step along the platform's right edge is (+2, +1), along its
// left edge (-2, +1), and up is (0, -1). Flat fills only. Lime is the brand ramp and the cards' paper and ink are
// slate, so it follows light and dark. Its motion is CSS (app/hero-animations.css, the kh-* classes), still under
// reduced motion. Decorative: one image with one label.
import type { CSSProperties, ReactNode } from 'react';

import { Cube, LIME, type Shades } from './iso-cube';

// The five other apps, each in its own colour (light on top, mid at the left, dark at the right), back row
// first so a nearer cube is drawn over a farther one. `turn` is its place in the round of lifts. The amber cube
// is livedocuments: the one amber on the site.
const APPS: readonly { cx: number; cy: number; turn: number; shades: Shades }[] = [
  {
    cx: 190,
    cy: 218,
    turn: 1,
    shades: { top: 'fill-violet-300', left: 'fill-violet-500', right: 'fill-violet-700' },
  },
  {
    cx: 370,
    cy: 218,
    turn: 2,
    shades: { top: 'fill-amber-300', left: 'fill-amber-500', right: 'fill-amber-700' },
  },
  {
    cx: 112,
    cy: 268,
    turn: 0,
    shades: { top: 'fill-sky-300', left: 'fill-sky-500', right: 'fill-sky-700' },
  },
  {
    cx: 448,
    cy: 268,
    turn: 3,
    shades: { top: 'fill-rose-300', left: 'fill-rose-500', right: 'fill-rose-700' },
  },
  {
    cx: 280,
    cy: 346,
    turn: 4,
    shades: { top: 'fill-emerald-300', left: 'fill-emerald-500', right: 'fill-emerald-700' },
  },
];

// Where the knowledgebase's cube stands on the platform, and its size.
const CORE = { cx: 280, cy: 274, half: 62, height: 78 };
// The platform's place in the drawing: under the two cards.
const PLATFORM = 'translate(20 100)';

const INK = 'stroke-slate-900 dark:stroke-slate-100';
const PAPER = 'fill-white dark:fill-slate-800';
const WORDS = 'fill-slate-900 dark:fill-slate-50';
const QUIET = 'fill-slate-500 dark:fill-slate-400';
const DOT = 'kh-dot fill-brand-400 dark:fill-brand-300';

const turn = (i: number) => ({ '--kh-i': i }) as CSSProperties;

// A card with a lime shadow set off down and right, and a dark outline.
function Card({
  x,
  y,
  width,
  height,
  className,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <g className={className}>
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

function AppCube({ app }: { app: (typeof APPS)[number] }) {
  return (
    <g className="kh-bob" style={turn(app.turn)}>
      <Cube cx={app.cx} cy={app.cy} half={22} height={26} shades={app.shades} />
    </g>
  );
}

export function HeroIllustration({ className = '' }: { className?: string }) {
  const coreTop = CORE.cy - CORE.height;
  return (
    <svg
      role="img"
      aria-label="Five small cubes in the other liveworkspace apps' colours feed one large lime cube of knowledge. A person's question and an agent's cited, verified answer both come from it."
      viewBox="0 0 600 500"
      className={className}
      fontFamily="inherit"
    >
      <g aria-hidden="true">
        <g transform={PLATFORM}>
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
            className="kh-ring stroke-brand-500"
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
              className="kh-flow stroke-brand-600 dark:stroke-brand-300"
            />
          ))}

          {APPS.slice(0, 4).map((app) => (
            <AppCube key={app.turn} app={app} />
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
              <path d="M15 40 L27 53 L48 25" fill="none" className="kh-tick" />
            </g>
          </Cube>

          {APPS.slice(4).map((app) => (
            <AppCube key={app.turn} app={app} />
          ))}
        </g>

        {/* Each reader's dotted line: the question into the cube, the answer out of it. */}
        <g
          fill="none"
          strokeWidth={3}
          strokeDasharray="0.1 8.9"
          strokeLinecap="round"
          className="stroke-slate-500 dark:stroke-slate-400"
        >
          <path d="M146 124 C 146 196, 238 204, 276 270" className="kh-ask" />
          <path d="M324 270 C 366 214, 452 226, 452 174" className="kh-answer" />
        </g>

        {/* A person's question. */}
        <Card x={14} y={20} width={264} height={98} className="kh-float">
          <circle cx={54} cy={69} r={19} strokeWidth={2.5} className={`fill-sky-300 ${INK}`} />
          <circle cx={54} cy={63.5} r={6} className="fill-slate-900" />
          <path d="M42 82 a12 10 0 0 1 24 0" className="fill-slate-900" />
          <text x={86} y={50} fontSize={11} fontWeight={700} letterSpacing={0.6} className={QUIET}>
            MAYA ASKS
          </text>
          <text x={86} y={72} fontSize={15} fontWeight={600} className={WORDS}>
            How do we roll back
          </text>
          <text x={86} y={92} fontSize={15} fontWeight={600} className={WORDS}>
            a release?
          </text>
        </Card>

        {/* An agent's cited answer, from a page someone verified. */}
        <Card x={296} y={8} width={290} height={160} className="kh-float-late">
          <rect
            x={312}
            y={26}
            width={36}
            height={36}
            rx={10}
            className="fill-slate-900 dark:fill-slate-950"
          />
          <path d="M330 26 v-7" strokeWidth={2.5} strokeLinecap="round" className={INK} />
          <circle cx={330} cy={17} r={3} className="fill-brand-400" />
          <circle cx={323} cy={41} r={3.5} className="fill-brand-300" />
          <circle cx={337} cy={41} r={3.5} className="fill-brand-300" />
          <path
            d="M323 52 h14"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-brand-300"
          />
          <text x={360} y={34} fontSize={11} fontWeight={700} letterSpacing={0.6} className={QUIET}>
            YOUR AGENT ANSWERS
          </text>
          <text x={360} y={56} fontSize={15} fontWeight={600} className={WORDS}>
            Run the rollback job,
          </text>
          <text x={360} y={76} fontSize={15} fontWeight={600} className={WORDS}>
            then tell #releases.
            <tspan dx={5} fontWeight={700} className="fill-brand-700 dark:fill-brand-300">
              [1]
            </tspan>
          </text>
          <path
            d="M312 94 H570"
            strokeWidth={1.5}
            className="stroke-slate-200 dark:stroke-slate-700"
          />
          {/* The page the answer came from. */}
          <rect
            x={312}
            y={104}
            width={150}
            height={24}
            rx={7}
            className="fill-brand-100 dark:fill-brand-900"
          />
          <path
            d="M321 110 h7 l3 3 v9 h-10 z"
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="fill-white stroke-brand-700 dark:fill-brand-950 dark:stroke-brand-300"
          />
          <text
            x={338}
            y={120.5}
            fontSize={12}
            fontWeight={600}
            className="fill-brand-900 dark:fill-brand-100"
          >
            Release Runbook
          </text>
          {/* Who vouches for it, and when. */}
          <circle cx={323} cy={147} r={10} className="fill-emerald-500" />
          <path
            d="M318 147.5 l3.5 3.5 l6.5 -7.5"
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-white"
          />
          <text x={340} y={151.5} fontSize={12}>
            <tspan fontWeight={600} className={WORDS}>
              Verified by Priya
            </tspan>
            <tspan dx={5} className={QUIET}>
              on 12 Nov
            </tspan>
          </text>
        </Card>

        {/* A few lime dots. */}
        <circle cx={300} cy={228} r={4.5} className={DOT} style={turn(0)} />
        <circle cx={238} cy={238} r={3} className={DOT} style={turn(1)} />
        <circle cx={366} cy={246} r={3.5} className={DOT} style={turn(2)} />
        <circle cx={40} cy={262} r={4} className={DOT} style={turn(3)} />
        <circle cx={566} cy={270} r={3.5} className={DOT} style={turn(4)} />
        <circle cx={92} cy={226} r={2.5} className={DOT} style={turn(5)} />
        <circle cx={520} cy={238} r={2.5} className={DOT} style={turn(6)} />
      </g>
    </svg>
  );
}
