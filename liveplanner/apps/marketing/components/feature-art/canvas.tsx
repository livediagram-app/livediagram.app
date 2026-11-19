// Feature illustration: the template picker (the Plan, Sheets and Forms categories' template cards).
// A small mock of New Plan's starters, plain SVG on the card's 300 by 96 stage (Scene in
// ./canvas-parts), composed across the full width. Each category shows its own starters by their
// catalogue names (packages/templates/src/template-catalogue.ts, packages/forms/src/starters.ts).
// Motion runs on one shared 6s timeline (app/feature-art/canvas.css, the canvas and collaboration
// block): pieces are drawn where they end up and staggered with --d, and every one settles to its
// finished frame under reduced motion.

import type { ReactNode } from 'react';
import { Panel, Pointer, Scene, TEXT, YOU, at, from } from './canvas-parts';

// The template cards' previews, each drawn in its card's own space (a 60-wide card, its preview
// well from (4, 18) to (56, 65)).
const CARD = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const WELL = 'fill-slate-100 dark:fill-slate-700/60';
const GRID = 'stroke-slate-200 dark:stroke-slate-600';
const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';
const AMBER = '#f59e0b';
const PINK = '#ec4899';
const SKY = '#0ea5e9';
const RED = '#ef4444';

/** A board: three columns of cards, fewer to the right. */
const kanban = (
  <g>
    {[9, 24, 39].map((x, c) => (
      <g key={x}>
        <rect className={WELL} x={x} y="24" width="12" height="38" rx="2" />
        {Array.from({ length: 3 - c }, (_, i) => (
          <rect
            key={i}
            className={CARD}
            x={x + 1.5}
            y={27 + i * 8}
            width="9"
            height="6"
            rx="1.2"
            strokeWidth="0.8"
          />
        ))}
      </g>
    ))}
  </g>
);

/** A Gantt chart: bars staggered along the weeks. */
const gantt = (
  <g>
    <g className={GRID} strokeWidth="0.6">
      {[19, 29, 39, 49].map((x) => (
        <path key={x} d={`M${x} 23 V62`} />
      ))}
    </g>
    {(
      [
        [10, 26, 20, VIOLET],
        [18, 34, 18, EMERALD],
        [26, 42, 22, AMBER],
        [14, 50, 26, PINK],
      ] as const
    ).map(([x, y, w, fill]) => (
      <rect key={y} x={x} y={y} width={w} height="5" rx="2.5" fill={fill} />
    ))}
  </g>
);

/** A Sheet's grid, its header row shaded, with what sets each one apart drawn over its cells. */
function sheet(kind: 'chart' | 'invoice' | 'pipeline' | 'grades') {
  return (
    <g>
      <rect className={WELL} x="9" y="23" width="42" height="6" rx="1" />
      <g className={GRID} strokeWidth="0.7">
        {[29, 35, 41, 47, 53, 59].map((y) => (
          <path key={y} d={`M9 ${y} H51`} />
        ))}
        <path d="M23 23 V59 M37 23 V59" />
      </g>
      {kind === 'chart'
        ? [
            [26, 10],
            [33, 16],
            [40, 8],
            [47, 13],
          ].map(([x, h]) => (
            <rect key={x} x={x} y={58 - h!} width="5" height={h} rx="1" fill={VIOLET} />
          ))
        : null}
      {kind === 'invoice' ? (
        <g>
          {[31, 37, 43].map((y, i) => (
            <rect
              key={y}
              x={41 - i * 2}
              y={y + 0.8}
              width={8 + i * 2}
              height="2.4"
              rx="1"
              className={WELL}
            />
          ))}
          <rect x="9" y="53" width="42" height="6" fill={EMERALD} fillOpacity="0.18" />
          <rect x="39" y="54.6" width="10" height="2.8" rx="1" fill={EMERALD} />
        </g>
      ) : null}
      {kind === 'pipeline'
        ? [SKY, AMBER, VIOLET, EMERALD, AMBER].map((fill, i) => (
            <rect key={i} x="25" y={30.6 + i * 6} width="10" height="2.8" rx="1.4" fill={fill} />
          ))
        : null}
      {kind === 'grades'
        ? [EMERALD, EMERALD, AMBER, EMERALD, RED].map((fill, i) => (
            <g key={i}>
              <rect
                x="39"
                y={30.4 + i * 6}
                width="10"
                height="3.2"
                rx="1"
                fill={fill}
                fillOpacity="0.25"
              />
              <rect x="42" y={31.2 + i * 6} width="5" height="1.6" rx="0.8" fill={fill} />
            </g>
          ))
        : null}
    </g>
  );
}

/** A form: its cover band in its colour, its questions as the starter asks them, and Submit. */
function form(colour: string, ask: 'text' | 'choice' | 'rating') {
  return (
    <g>
      <rect x="9" y="22" width="42" height="7" rx="1.5" fill={colour} fillOpacity="0.85" />
      <rect className={WELL} x="11" y="33" width="18" height="2.5" rx="1" />
      {ask === 'rating' ? (
        [0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M${14 + i * 7} 38.4l1.1 2.2 2.4 0.3-1.8 1.6 0.5 2.4-2.2-1.2-2.2 1.2 0.5-2.4-1.8-1.6 2.4-0.3z`}
            fill={i < 4 ? AMBER : 'none'}
            stroke={AMBER}
            strokeWidth="0.5"
          />
        ))
      ) : ask === 'choice' ? (
        [0, 1].map((i) => (
          <g key={i}>
            <circle
              cx={13}
              cy={39.6 + i * 4.4}
              r="1.5"
              fill={i === 0 ? colour : 'none'}
              stroke={colour}
              strokeWidth="0.6"
            />
            <rect className={WELL} x="16" y={38.6 + i * 4.4} width={16 - i * 4} height="2" rx="1" />
          </g>
        ))
      ) : (
        <rect className={CARD} x="11" y="37" width="38" height="5" rx="1.2" strokeWidth="0.7" />
      )}
      <rect className={WELL} x="11" y="46" width="14" height="2.5" rx="1" />
      <rect className={CARD} x="11" y="50" width="38" height="5" rx="1.2" strokeWidth="0.7" />
      <rect x="35" y="57.5" width="14" height="5" rx="2.5" fill={colour} />
    </g>
  );
}

// Each category's first four starters, as New Plan names them.
const SETS: Record<'plans' | 'sheets' | 'forms', { name: string; art: ReactNode }[]> = {
  plans: [
    { name: 'Project Planner', art: gantt },
    { name: 'Sprint Board', art: kanban },
    { name: 'Budget Planner', art: sheet('chart') },
    { name: 'Event Planner', art: form(VIOLET, 'choice') },
  ],
  sheets: [
    { name: 'Budget Planner', art: sheet('chart') },
    { name: 'Invoice', art: sheet('invoice') },
    { name: 'Sales Pipeline', art: sheet('pipeline') },
    { name: 'Grade Book', art: sheet('grades') },
  ],
  forms: [
    { name: 'Bug Report', art: form(RED, 'text') },
    { name: 'Feedback', art: form(AMBER, 'rating') },
    { name: 'Event RSVP', art: form(VIOLET, 'choice') },
    { name: 'Job Application', art: form(SKY, 'text') },
  ],
};

/** The template picker: four starters of one kind, the one under the pointer lifting to be used. */
export function TemplatesArt({ set = 'plans' }: { set?: keyof typeof SETS }) {
  return (
    <Scene>
      {SETS[set].map(({ name, art }, i) => {
        const x = 12 + i * 72;
        return (
          <g key={name} transform={`translate(${x} 0)`}>
            {i === 1 ? (
              <rect
                className="fa-a-pop fill-none stroke-brand-500"
                style={at(1.2)}
                x="-2.5"
                y="11.5"
                width="65"
                height="75"
                rx="7.5"
                strokeWidth="1.5"
              />
            ) : null}
            <Panel x={0} y={14} w={60} h={70} />
            <rect
              className="fill-(--art-paper) stroke-slate-100 dark:stroke-slate-700"
              x="4"
              y="18"
              width="52"
              height="47"
              rx="3.5"
              strokeWidth="0.8"
            />
            {art}
            <text
              className={TEXT}
              x="30"
              y="75.5"
              fontSize={name.length > 12 ? '5.8' : '6.6'}
              fontWeight="600"
              textAnchor="middle"
            >
              {name}
            </text>
          </g>
        );
      })}
      <Pointer x={110} y={50} color={YOU} className="fa-a-move" style={from(70, 30, 0.2)} />
    </Scene>
  );
}
