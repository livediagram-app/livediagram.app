import type { ReactElement, SVGProps } from 'react';
import type { TemplateKind } from '@liveplanner/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group 2: the Kanban Board. Static SVG preview tiles (one branch per TemplateKind; see template-preview.tsx for who
// renders them); TemplatePreview chains the groups with ??.
export function templatePreviewGroup2(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'kanban':
      // Five tinted lanes (Backlog slate, To do sky, In progress amber,
      // Review violet, Done green), each topped by its deep-hue header bar.
      // In progress holds the blocked ticket (red border). Hover story: work
      // moves right. The Review ticket lands in Done, an In progress ticket
      // follows it into Review, and Done's trophy pops once the ticket lands.
      // The moving cards are drawn after every lane so they pass OVER them.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          {[
            {
              x: 2,
              fill: 'rgb(241 245 249)',
              stroke: 'rgb(203 213 225)',
              ink: 'rgb(51 65 85)',
              cards: [9, 17, 25],
            },
            {
              x: 17.5,
              fill: 'rgb(224 242 254)',
              stroke: 'rgb(125 211 252)',
              ink: 'rgb(3 105 161)',
              cards: [9, 17],
            },
            {
              x: 33,
              fill: 'rgb(254 243 199)',
              stroke: 'rgb(252 211 77)',
              ink: 'rgb(180 83 9)',
              cards: [9],
            },
            {
              x: 48.5,
              fill: 'rgb(237 233 254)',
              stroke: 'rgb(196 181 253)',
              ink: 'rgb(109 40 217)',
              cards: [],
            },
            {
              x: 64,
              fill: 'rgb(220 252 231)',
              stroke: 'rgb(134 239 172)',
              ink: 'rgb(21 128 61)',
              cards: [9, 17],
            },
          ].map((col) => (
            <g key={col.x}>
              <rect
                x={col.x}
                y="3"
                width="14"
                height="44"
                rx="1.5"
                fill={col.fill}
                stroke={col.stroke}
                strokeWidth="0.75"
              />
              <rect x={col.x + 2} y="5" width="7" height="1.8" rx="0.9" fill={col.ink} />
              {col.cards.map((sy) => (
                <KanbanCard key={sy} x={col.x + 1} y={sy} />
              ))}
            </g>
          ))}
          {/* The blocked ticket: a red border in In progress. */}
          <KanbanCard x={34} y={25} stroke="rgb(220 38 38)" strokeWidth="1" />
          <KanbanCard
            x={49.5}
            y={9}
            className="pv-shift"
            style={pv({ '--pv-dx': '15.5px', '--pv-dy': '16px', '--pv-at': '1000ms' })}
          />
          <KanbanCard
            x={34}
            y={17}
            className="pv-shift"
            style={pv({ '--pv-dx': '15.5px', '--pv-dy': '-8px', '--pv-at': '1600ms' })}
          />
          <circle
            className="pv-new"
            opacity="0"
            cx="71"
            cy="40"
            r="3"
            fill="rgb(250 204 21)"
            stroke="rgb(202 138 4)"
            strokeWidth="0.75"
            style={pv({ '--pv-at': '2200ms' })}
          />
        </svg>
      );
    default:
      return null;
  }
}

// One kanban card (the kanban preview draws ten, two of them moving).
function KanbanCard({
  x,
  y,
  ...rest
}: { x: number; y: number } & Omit<SVGProps<SVGRectElement>, 'x' | 'y'>) {
  return (
    <rect
      x={x}
      y={y}
      width="12"
      height="6"
      rx="1"
      fill="white"
      stroke="rgb(148 163 184)"
      strokeWidth="0.5"
      {...rest}
    />
  );
}
