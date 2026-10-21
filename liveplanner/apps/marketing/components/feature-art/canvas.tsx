// Feature illustration: the template picker (the Plan, Sheets and Forms categories' template cards).
// A small mock of the New Project step, plain SVG on the card's 300 by 96 stage (Scene in
// ./canvas-parts), composed across the full width. Motion runs on one shared 6s timeline
// (app/feature-art/canvas.css, the canvas and collaboration block): pieces are drawn where they end up
// and staggered with --d, and every one settles to its finished frame under reduced motion.

import type { ReactNode } from 'react';
import { Panel, Pointer, Scene, TEXT, YOU, at, from } from './canvas-parts';

// The template cards' previews, each drawn in its card's own space (a 60-wide card, its preview
// well from (4, 18) to (56, 65)).
const CARD = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const WELL = 'fill-slate-100 dark:fill-slate-700/60';

const PREVIEWS: { name: string; art: ReactNode }[] = [
  {
    name: 'Kanban',
    art: (
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
    ),
  },
  {
    name: 'Budget',
    art: (
      <g>
        {/* A Sheet's grid, its header row shaded, and a small bar chart over its cells. */}
        <rect className={WELL} x="9" y="23" width="42" height="6" rx="1" />
        <g className="stroke-slate-200 dark:stroke-slate-600" strokeWidth="0.7">
          {[29, 35, 41, 47, 53, 59].map((y) => (
            <path key={y} d={`M9 ${y} H51`} />
          ))}
          <path d="M23 23 V59 M37 23 V59" />
        </g>
        {[
          [26, 10],
          [33, 16],
          [40, 8],
          [47, 13],
        ].map(([x, h]) => (
          <rect key={x} x={x} y={58 - h!} width="5" height={h} rx="1" fill="#8b5cf6" />
        ))}
      </g>
    ),
  },
  {
    name: 'RSVP form',
    art: (
      <g>
        {/* A form: its cover band, two questions and a Submit button. */}
        <rect x="9" y="22" width="42" height="7" rx="1.5" fill="#8b5cf6" fillOpacity="0.85" />
        {[33, 45].map((y) => (
          <g key={y}>
            <rect className={WELL} x="11" y={y} width="18" height="2.5" rx="1" />
            <rect
              className={CARD}
              x="11"
              y={y + 4}
              width="38"
              height="5"
              rx="1.2"
              strokeWidth="0.7"
            />
          </g>
        ))}
        <rect x="35" y="57.5" width="14" height="5" rx="2.5" fill="#10b981" />
      </g>
    ),
  },
  {
    name: 'Roadmap',
    art: (
      <g>
        {/* A Gantt view: bars staggered along the weeks. */}
        <g className="stroke-slate-200 dark:stroke-slate-600" strokeWidth="0.6">
          {[19, 29, 39, 49].map((x) => (
            <path key={x} d={`M${x} 23 V62`} />
          ))}
        </g>
        {[
          [10, 26, 20, '#8b5cf6'],
          [18, 34, 18, '#10b981'],
          [26, 42, 22, '#f59e0b'],
          [14, 50, 26, '#ec4899'],
        ].map(([x, y, w, fill]) => (
          <rect
            key={String(y)}
            x={x as number}
            y={y as number}
            width={w as number}
            height="5"
            rx="2.5"
            fill={fill as string}
          />
        ))}
      </g>
    ),
  },
];

/** The template picker: four starters, the one under the pointer lifting to be used. */
export function TemplatesArt() {
  return (
    <Scene>
      {PREVIEWS.map(({ name, art }, i) => {
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
              fontSize="7"
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
