'use client';

import { ART, TourArtFrame } from './TourArtFrame';

// The Plan tour's welcome card heroes (docs/specs/026-plan/plan-tour.md "The steps"), one per offer: a board with a
// card moving along it, a sheet with its selection stepping across as a value is typed, and both side by side for
// the choice card. Drawn in TourArtFrame's recipe.

const BOARD_COLUMNS = [44, 124, 204];
const BOARDS_CSS = `
  @keyframes plan-art-move {
    0%, 18% { transform: translate(0px, 0px); }
    30% { transform: translate(40px, -6px) rotate(3deg); }
    44%, 86% { transform: translate(80px, 0px); }
    100% { transform: translate(0px, 0px); }
  }
  .plan-art-card { animation: plan-art-move 4.6s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .plan-art-card { animation: none; }
  }
`;

function Card({ x, y }: { x: number; y: number }) {
  return <rect x={x} y={y} width="52" height="18" rx="3" className={ART.paper} />;
}

function MovingCard({ x, y }: { x: number; y: number }) {
  return (
    <g className="tour-art-el plan-art-card">
      <rect
        x={x}
        y={y}
        width="52"
        height="18"
        rx="3"
        className={ART.accentSoft}
        strokeWidth="1.5"
      />
      <rect x={x} y={y} width="3" height="18" rx="1.5" className={ART.accent} />
    </g>
  );
}

/** Boards: three columns, one card moving from the first to the second and settling. */
export function BoardsTourArt() {
  return (
    <TourArtFrame css={BOARDS_CSS}>
      {BOARD_COLUMNS.map((x, i) => (
        <g key={x}>
          <rect x={x} y="14" width="68" height="78" rx="6" className={ART.well} />
          <rect
            x={x + 8}
            y="21"
            width={i === 1 ? 30 : 24}
            height="4"
            rx="2"
            className={ART.faint}
          />
        </g>
      ))}
      <Card x={52} y={58} />
      <Card x={132} y={58} />
      <Card x={212} y={32} />
      <MovingCard x={52} y={32} />
    </TourArtFrame>
  );
}

// The sheet's grid: a formula bar, column and row headers, and four rows of four cells.
const COL_W = 49;
const ROW_H = 15;
const SHEETS_CSS = `
  @keyframes sheet-art-step {
    0%, 30% { transform: translate(0px, 0px); }
    36%, 64% { transform: translate(${COL_W}px, 0px); }
    70%, 92% { transform: translate(${COL_W}px, ${ROW_H}px); }
    100% { transform: translate(0px, 0px); }
  }
  @keyframes sheet-art-type {
    0%, 4% { transform: scaleX(0); }
    24%, 100% { transform: scaleX(1); }
  }
  .sheet-art-select { animation: sheet-art-step 5.2s ease-in-out infinite; }
  .sheet-art-typed { transform-origin: 0% 50%; animation: sheet-art-type 5.2s steps(6, end) infinite; }
  @media (prefers-reduced-motion: reduce) {
    .sheet-art-select, .sheet-art-typed { animation: none; }
  }
`;

// Short value bars in some cells: [column, row, width].
const VALUES: [number, number, number][] = [
  [0, 1, 24],
  [0, 2, 30],
  [1, 1, 18],
  [1, 2, 22],
  [2, 0, 26],
  [2, 2, 14],
  [3, 0, 20],
];

function Grid({ x, y, cols, rows }: { x: number; y: number; cols: number; rows: number }) {
  const left = x + 14;
  const top = y + 10;
  return (
    <g>
      {/* Column and row headers. */}
      <rect x={x} y={y} width={14 + cols * COL_W} height="10" className={ART.well} />
      <rect x={x} y={y} width="14" height={10 + rows * ROW_H} className={ART.well} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={left + c * COL_W}
            y={top + r * ROW_H}
            width={COL_W}
            height={ROW_H}
            className={ART.paper}
            strokeWidth="0.75"
          />
        )),
      )}
      {VALUES.filter(([c, r]) => c < cols && r < rows).map(([c, r, w]) => (
        <rect
          key={`v${c}-${r}`}
          x={left + c * COL_W + 5}
          y={top + r * ROW_H + 6}
          width={w}
          height="3"
          rx="1.5"
          className={ART.faint}
        />
      ))}
      {/* A1, its value typed in, and the selection stepping across and down as Tab and Enter move it. */}
      <rect
        x={left + 5}
        y={top + 6}
        width="28"
        height="3"
        rx="1.5"
        className={`tour-art-el sheet-art-typed ${ART.accent}`}
      />
      <rect
        x={left}
        y={top}
        width={COL_W}
        height={ROW_H}
        fill="none"
        strokeWidth="2"
        className="tour-art-el sheet-art-select stroke-brand-500"
      />
    </g>
  );
}

/** Sheets: a grid under its formula bar, A1 typed into, the selection stepping on. */
export function SheetsTourArt() {
  return (
    <TourArtFrame css={SHEETS_CSS}>
      {/* The formula bar: fx and the selected cell's value. */}
      <rect x="44" y="8" width="210" height="12" rx="3" className={ART.paper} />
      <rect x="49" y="12" width="9" height="4" rx="1" className={ART.ink} />
      <rect
        x="64"
        y="12.5"
        width="40"
        height="3"
        rx="1.5"
        className={`tour-art-el sheet-art-typed ${ART.faint}`}
      />
      <Grid x={44} y={24} cols={4} rows={4} />
    </TourArtFrame>
  );
}

/** Both, for the choice card: a two-column board beside a small sheet. */
export function PlanChoiceTourArt() {
  return (
    <TourArtFrame css={BOARDS_CSS + SHEETS_CSS}>
      {[22, 98].map((x) => (
        <g key={x}>
          <rect x={x} y="14" width="68" height="78" rx="6" className={ART.well} />
          <rect x={x + 8} y="21" width="24" height="4" rx="2" className={ART.faint} />
        </g>
      ))}
      <Card x={106} y={32} />
      <MovingCard x={30} y={58} />
      <Grid x={162} y={22} cols={2} rows={4} />
    </TourArtFrame>
  );
}
