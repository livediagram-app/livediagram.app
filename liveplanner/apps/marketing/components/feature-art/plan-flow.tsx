// Feature illustrations for the charts of how work moves: the three flow charts (Cycle Time, Throughput and
// Cumulative Flow, docs/specs/026-plan/plan-views.md "Flow charts") and the Gantt chart's dependency clashes.
// Colours are the editor's own: the phase colours (packages/plan-art/src/phase-colours.ts) read as status, so they
// stay the same in either appearance, and the percentile and average lines are drawn in the chart's text ink.
// Motion reuses the canvas card timeline (fa-a-* in app/feature-art/canvas.css), which settles to the finished
// frame under reduced motion.
import type { ReactNode } from 'react';
import { MUTED, Panel, RULE, Scene, TEXT, at } from './canvas-parts';

// PHASE_COLOURS and the clash amber, as the live views draw them.
const TODO = '#94a3b8';
const DOING = '#3b82f6';
const DONE = '#16a34a';
const CLASH = '#d97706';
const TODAY = '#dc2626';
// The clash mark's disc: amber-500 under dark ink (clash-glyph.tsx), a step lighter than the arrow.
const CLASH_MARK = '#f59e0b';
// The chart's text ink, which its percentile and average lines are drawn in.
const INK_LINE = 'stroke-slate-600 dark:stroke-slate-300';
const INK_TEXT = 'fill-slate-600 dark:fill-slate-300';

/** One flow chart's frame: its name and count, the summary line under them, and the axis. */
function FlowFrame({
  x,
  title,
  count,
  children,
}: {
  x: number;
  title: string;
  count: string;
  children: ReactNode;
}) {
  return (
    <g>
      <Panel x={x} y={6} w={92} h={84} />
      <text className={TEXT} x={x + 7} y={17.5} fontSize="6" fontWeight="700">
        {title}
      </text>
      <text className={MUTED} x={x + 85} y={17.5} fontSize="4.6" fontWeight="600" textAnchor="end">
        {count}
      </text>
      {children}
      <path className={RULE} d={`M${x + 7} 82.5h78`} strokeWidth="0.7" />
    </g>
  );
}

/** See how work flows: Cycle Time's dots under its 85% line, Throughput's weekly bars, Cumulative Flow's bands. */
export function FlowChartsArt() {
  // Cycle Time: a dot per card finished in the range, at the day it finished and the days it took.
  const dots: [number, number][] = [
    [4, 66],
    [11, 58],
    [17, 72],
    [24, 61],
    [30, 41],
    [37, 68],
    [43, 54],
    [50, 74],
    [56, 63],
    [63, 50],
    [69, 70],
    [75, 71],
  ];
  // Throughput: cards finished each week, the week still running last (so lighter). 8 a week over the whole ones.
  const weeks = [7, 9, 6, 10, 8, 9, 4];
  const foot = 82;
  return (
    <Scene>
      <FlowFrame x={8} title="Cycle Time" count="12 cards">
        <text className={INK_TEXT} x={15} y={26} fontSize="4.6">
          <tspan fontWeight="700">85%</tspan> in 6 days or less ·{' '}
          <tspan fontWeight="700">50%</tspan> in 3
        </text>
        {/* The 85% line, dashed, and the 50% line, each named at its right end. */}
        <path
          d="M15 46h78"
          className={INK_LINE}
          strokeOpacity="0.7"
          strokeWidth="0.8"
          strokeDasharray="2.4 1.8"
        />
        <text className={INK_TEXT} x={93} y={44.4} fontSize="4" fontWeight="700" textAnchor="end">
          85%
        </text>
        <path d="M15 62h78" className={INK_LINE} strokeOpacity="0.7" strokeWidth="0.8" />
        <text className={INK_TEXT} x={93} y={60.4} fontSize="4" fontWeight="700" textAnchor="end">
          50%
        </text>
        {dots.map(([dx, y], i) => (
          <circle
            key={`${dx}-${y}`}
            className="fa-a-pop stroke-white dark:stroke-slate-800"
            style={at(0.1 + i * 0.07)}
            cx={15 + dx}
            cy={y}
            r="2.1"
            fill={DOING}
            fillOpacity="0.85"
            strokeWidth="0.7"
          />
        ))}
      </FlowFrame>

      <FlowFrame x={104} title="Throughput" count="53 cards">
        <text className={INK_TEXT} x={111} y={26} fontSize="4.6">
          <tspan fontWeight="700">8 a week on average</tspan>
        </text>
        {weeks.map((n, i) => {
          const h = n * 4.2;
          const x = 113 + i * 10.6;
          return (
            <g key={i}>
              <rect
                x={x}
                y={foot - h}
                width="7.4"
                height={h}
                rx="1.2"
                fill={DOING}
                fillOpacity={i === weeks.length - 1 ? 0.4 : 1}
              />
              <text
                className={INK_TEXT}
                x={x + 3.7}
                y={foot - h - 1.6}
                fontSize="3.8"
                fontWeight="700"
                textAnchor="middle"
              >
                {n}
              </text>
            </g>
          );
        })}
        {/* The average over the whole weeks. */}
        <path
          d={`M111 ${foot - 8.2 * 4.2}h78`}
          className={INK_LINE}
          strokeOpacity="0.7"
          strokeWidth="0.8"
          strokeDasharray="2.4 1.8"
        />
        <text
          className={`${INK_TEXT} stroke-white dark:stroke-slate-800`}
          x={189}
          y={foot - 8.2 * 4.2 - 1.6}
          fontSize="3.8"
          fontWeight="700"
          textAnchor="end"
          strokeWidth="1.2"
          paintOrder="stroke"
        >
          Avg 8
        </text>
      </FlowFrame>

      <FlowFrame x={200} title="Cumulative Flow" count="59 cards">
        <text className={INK_TEXT} x={207} y={26} fontSize="4.6">
          <tspan fontWeight="700">12</tspan> in progress · <tspan fontWeight="700">41</tspan> done
        </text>
        {/* The key, first column first, as the chart lists it. */}
        {[
          { label: 'To Do', colour: TODO, x: 207 },
          { label: 'In Progress', colour: DOING, x: 227 },
          { label: 'Done', colour: DONE, x: 257 },
        ].map((k) => (
          <g key={k.label}>
            <rect x={k.x} y={30.4} width="3.4" height="3.4" rx="0.8" fill={k.colour} />
            <text className={MUTED} x={k.x + 4.8} y={33.5} fontSize="3.9" fontWeight="600">
              {k.label}
            </text>
          </g>
        ))}
        {/* Done at the bottom and growing, In Progress widening (where work piles up), To Do on top. */}
        <path d="M207 82 L285 82 L285 51 L246 68 L207 76 Z" fill={DONE} />
        <g className="fa-a-in" style={at(0.3)}>
          <path d="M207 76 L246 68 L285 51 L285 42 L246 60 L207 70 Z" fill={DOING} />
        </g>
        <path d="M207 70 L246 60 L285 42 L285 38 L246 52 L207 60 Z" fill={TODO} />
      </FlowFrame>
    </Scene>
  );
}

/** A Gantt row's name: its colour dot, its number and its title, as the chart's name column draws it. */
function GanttName({
  y,
  colour,
  num,
  title,
}: {
  y: number;
  colour: string;
  num: string;
  title: string;
}) {
  return (
    <g>
      <circle cx={19} cy={y + 4.6} r="1.8" fill={colour} />
      <text className={MUTED} x={23.5} y={y + 6.6} fontSize="5" fontWeight="600">
        {num}
      </text>
      <text className={TEXT} x={35} y={y + 6.6} fontSize="5.6" fontWeight="600">
        {title}
      </text>
    </g>
  );
}

/**
 * A Gantt that spots clashes: T-5 Build is blocked by T-4 Design but starts before Design is due, so its arrow turns
 * amber and the amber "!" sits on Build's bar; the toast after a drag offers Move 2 Cards. */
export function GanttClashArt() {
  const rows = [
    { num: 'T-4', title: 'Design', colour: '#8b5cf6', x: 74, w: 82, y: 27 },
    { num: 'T-5', title: 'Build', colour: '#0ea5e9', x: 136, w: 70, y: 41 },
    { num: 'T-6', title: 'Launch', colour: '#10b981', x: 212, w: 32, y: 55 },
  ];
  // Mondays, as the chart's axis labels a window of weeks.
  const weeks = ['2 Nov', '9 Nov', '16 Nov', '23 Nov', '30 Nov'];
  return (
    <Scene>
      <Panel x={10} y={6} w={280} h={84} />
      <path className={RULE} d="M66 8v80" strokeWidth="0.6" />
      {weeks.map((d, i) => (
        <g key={d}>
          <text className={MUTED} x={75 + i * 44} y={16} fontSize="4.6" fontWeight="600">
            {d}
          </text>
          <path className={RULE} d={`M${74 + i * 44} 20v68`} strokeWidth="0.5" />
        </g>
      ))}
      <path className={RULE} d="M66 20h224" strokeWidth="0.6" />
      {/* Today. */}
      <path d="M118 20v68" stroke={TODAY} strokeWidth="0.8" />
      {rows.map((r) => (
        <g key={r.num}>
          <GanttName y={r.y} colour={r.colour} num={r.num} title={r.title} />
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={9.5}
            rx="2.5"
            fill={r.colour}
            fillOpacity="0.85"
          />
        </g>
      ))}
      {/* Build starts before Design is due: the Blocked By arrow from Design's end runs back to Build's start, amber. */}
      <path
        d="M156 31.75 h4 v4.6 h-28 v9.4 h3"
        fill="none"
        stroke={CLASH}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M136 45.75 l-2.6 -1.8 v3.6 z" fill={CLASH} />
      {/* Build to Launch: no clash, in the chart's muted ink. */}
      <path
        d="M206 45.75 h3 v14 h2"
        fill="none"
        className="stroke-slate-400 dark:stroke-slate-500"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path d="M212 59.75 l-2.6 -1.8 v3.6 z" className="fill-slate-400 dark:fill-slate-500" />
      {/* The clash mark at the start of Build's bar: dark ink on amber, as the chart draws it. */}
      <g className="fa-a-pop" style={at(0.4)}>
        <circle
          cx={137}
          cy={41.6}
          r="3.6"
          fill={CLASH_MARK}
          className="stroke-white dark:stroke-slate-800"
          strokeWidth="0.7"
        />
        <text x={137} y={43.5} fontSize="5.2" fontWeight="800" textAnchor="middle" fill="#020617">
          !
        </text>
      </g>
      {/* The offer after Design is dragged later, a toast as the editor shows one: it moves the cards that follow,
          as one undo. */}
      <g className="fa-a-late">
        <Panel x={70} y={66} w={214} h={19} />
        <circle
          cx={78}
          cy={75.5}
          r={3}
          fill="none"
          className="stroke-brand-700 dark:stroke-brand-400"
          strokeWidth="0.8"
        />
        <path
          d="M78 74.6v2.6"
          className="stroke-brand-700 dark:stroke-brand-400"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <circle cx={78} cy={73.4} r={0.45} className="fill-brand-700 dark:fill-brand-400" />
        <text className={TEXT} x={84.5} y={77.3} fontSize="4.7" fontWeight="500">
          2 cards that follow T-4 Design now start before it is due.
        </text>
        <text
          x={230}
          y={77.3}
          fontSize="4.7"
          fontWeight="700"
          textAnchor="middle"
          className="fill-brand-700 dark:fill-brand-300"
        >
          Move 2 Cards
        </text>
        <text
          x={263}
          y={77.3}
          fontSize="4.7"
          fontWeight="600"
          textAnchor="middle"
          className="fill-slate-600 dark:fill-slate-300"
        >
          Leave Them
        </text>
      </g>
    </Scene>
  );
}
