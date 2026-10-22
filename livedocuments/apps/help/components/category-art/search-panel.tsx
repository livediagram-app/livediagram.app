import type { ReactNode } from 'react';
import { Label } from '@/components/illustrations/primitives';
import { Card, Kbd, Stage } from './parts';

const G = 'fill-none stroke-current';

const GROUPS: {
  heading: string;
  rows: { glyph: ReactNode; title: string; where: string; active?: boolean }[];
}[] = [
  {
    heading: 'DOCUMENTS',
    rows: [
      {
        glyph: (
          <path
            d="M-4.5 -6 h6 l3 3 v9 h-9 Z"
            className={G}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        ),
        title: 'Product Roadmap',
        where: 'Team Space',
        active: true,
      },
    ],
  },
  {
    heading: 'TABS',
    rows: [
      {
        glyph: (
          <path
            d="M-6 -3 h5 l1 -2 h6 v10 h-12 Z"
            className={G}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        ),
        title: 'Roadmap Q3',
        where: 'Launch deck',
      },
    ],
  },
  {
    heading: 'ELEMENTS',
    rows: [
      {
        glyph: (
          <rect
            x={-5}
            y={-5}
            width={10}
            height={10}
            rx={1}
            className="fill-amber-200 stroke-amber-400"
            strokeWidth={1}
          />
        ),
        title: 'Roadmap review',
        where: 'Sticky note',
      },
    ],
  },
  {
    heading: 'HELP',
    rows: [
      {
        glyph: (
          <>
            <circle r={5.5} className={G} strokeWidth={1.3} />
            <path
              d="M-1.8 -1.6 a1.9 1.9 0 1 1 2.6 1.7 c-0.8 0.4 -0.8 0.8 -0.8 1.6"
              className={G}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
            <circle cy={3.4} r={0.7} className="fill-current" />
          </>
        ),
        title: 'Timeline: Roadmaps',
        where: 'Help Centre',
      },
    ],
  },
];

// Where each group starts: its heading's 10, then 24 a row, then a 4 gap before the next.
const GROUP_TOPS = GROUPS.reduce<number[]>(
  (tops, _, i) => [...tops, i === 0 ? 64 : tops[i - 1]! + 10 + 24 * GROUPS[i - 1]!.rows.length + 4],
  [],
);

// Search Panel: one box that finds everything. A query typed, and its results grouped by what they are:
// a document, a tab, an element on a canvas and a help guide.
export function SearchPanelArt() {
  return (
    <Stage>
      <Card x={58} y={14} w={284} h={198} r={14}>
        <circle cx={80} cy={36} r={6} className="fill-none stroke-brand-500" strokeWidth={1.8} />
        <path
          d="M84.5 40.5 l4 4"
          className="stroke-brand-500"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Label x={96} y={36.5} size={12} weight={600} tone="strong">
          roadmap
        </Label>
        <rect x={151} y={28} width={1.5} height={17} className="fill-brand-500" />
        <Kbd x={300} y={26} w={30} h={18} label="⌘K" />
        <line x1={58} y1={54} x2={342} y2={54} className="stroke-slate-200" strokeWidth={1} />
        {GROUPS.map((g, gi) => {
          const top = GROUP_TOPS[gi]!;
          const head = (
            <Label key={g.heading} x={72} y={top + 4} size={7.5} weight={700} tone="muted">
              {g.heading}
            </Label>
          );
          const rows = g.rows.map((r, ri) => {
            const ry = top + 10 + ri * 24;
            return (
              <g key={r.title}>
                {r.active && (
                  <rect
                    x={64}
                    y={ry}
                    width={272}
                    height={22}
                    rx={6}
                    className="fill-brand-50 stroke-brand-200"
                    strokeWidth={1}
                  />
                )}
                <g
                  transform={`translate(80 ${ry + 11})`}
                  className={r.active ? 'text-brand-700' : 'text-slate-500'}
                >
                  {r.glyph}
                </g>
                <Label
                  x={94}
                  y={ry + 11.5}
                  size={10}
                  weight={600}
                  tone={r.active ? 'accent' : 'strong'}
                >
                  {r.title}
                </Label>
                <Label x={326} y={ry + 11.5} anchor="end" size={8.5} tone="muted">
                  {r.where}
                </Label>
              </g>
            );
          });
          return (
            <g key={g.heading}>
              {head}
              {rows}
            </g>
          );
        })}
      </Card>
    </Stage>
  );
}
