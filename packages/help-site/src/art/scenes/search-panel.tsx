import type { ReactNode } from 'react';
import { Label } from '../primitives';
import { Card, Kbd, Stage } from '../parts';

const G = 'fill-none stroke-current';

/** The row glyphs most products' results use, each drawn about its centre. */
export const SEARCH_GLYPHS = {
  document: (
    <path d="M-4.5 -6 h6 l3 3 v9 h-9 Z" className={G} strokeWidth={1.3} strokeLinejoin="round" />
  ),
  tab: (
    <path d="M-6 -3 h5 l1 -2 h6 v10 h-12 Z" className={G} strokeWidth={1.3} strokeLinejoin="round" />
  ),
  sticky: (
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
  help: (
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
} satisfies Record<string, ReactNode>;

/** One group of results: its heading, then its rows. The first row of the first group is the one preselected. */
export type SearchGroup = {
  heading: string;
  rows: { glyph: ReactNode; title: string; where: string }[];
};

// Search Panel: one box that finds everything. A query typed, and its results grouped by what they are. The box is
// the same in every product; the product hands in the query and the groups its search really shows (its work, a
// tab, something on a tab, a help guide), up to five rows in all so they fit the card.
export function SearchPanelArt({ query, groups }: { query: string; groups: SearchGroup[] }) {
  // Where each group starts: its heading's 10, then 24 a row, then a 4 gap before the next.
  const tops = groups.reduce<number[]>(
    (acc, _, i) => [...acc, i === 0 ? 64 : acc[i - 1]! + 10 + 24 * groups[i - 1]!.rows.length + 4],
    [],
  );
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
          {query}
        </Label>
        <rect
          x={Math.round(96 + query.length * 7.9)}
          y={28}
          width={1.5}
          height={17}
          className="fill-brand-500"
        />
        <Kbd x={300} y={26} w={30} h={18} label="⌘K" />
        <line x1={58} y1={54} x2={342} y2={54} className="stroke-slate-200" strokeWidth={1} />
        {groups.map((g, gi) => {
          const top = tops[gi]!;
          return (
            <g key={g.heading}>
              <Label x={72} y={top + 4} size={7.5} weight={700} tone="muted">
                {g.heading}
              </Label>
              {g.rows.map((r, ri) => {
                const ry = top + 10 + ri * 24;
                const active = gi === 0 && ri === 0;
                return (
                  <g key={r.title}>
                    {active && (
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
                      className={active ? 'text-brand-700' : 'text-slate-500'}
                    >
                      {r.glyph}
                    </g>
                    <Label
                      x={94}
                      y={ry + 11.5}
                      size={10}
                      weight={600}
                      tone={active ? 'accent' : 'strong'}
                    >
                      {r.title}
                    </Label>
                    <Label x={326} y={ry + 11.5} anchor="end" size={8.5} tone="muted">
                      {r.where}
                    </Label>
                  </g>
                );
              })}
            </g>
          );
        })}
      </Card>
    </Stage>
  );
}
