// Feature illustration: a Sheet on a Plan tab (the Plans & boards category's spreadsheet card).
// A small grid with lettered columns and numbered rows, a formula typing into the total cell and
// its answer landing. Motion reuses the canvas card timeline (fa-a-* in
// app/feature-art-animations.css), which settles to the finished frame under reduced motion.
import { Panel, RULE, Scene, TEXT, MUTED, at } from './canvas-parts';

const COLS = ['A', 'B', 'C'];
const ROWS = [
  ['Design', '12', '4'],
  ['Build', '30', '9'],
  ['Launch', '8', '2'],
];

// The grid's geometry: a header row and column, then fixed-width cells.
const X0 = 46;
const Y0 = 10;
const HEAD_W = 14;
const HEAD_H = 11;
const CELL_W = 46;
const CELL_H = 13;

/** A spreadsheet tab: cells, a formula in the bar, and the total it works out. */
export function SheetsArt() {
  const width = HEAD_W + COLS.length * CELL_W;
  const height = HEAD_H + (ROWS.length + 1) * CELL_H;
  const colX = (i: number) => X0 + HEAD_W + i * CELL_W;
  const rowY = (i: number) => Y0 + HEAD_H + i * CELL_H;
  const totalY = rowY(ROWS.length);
  return (
    <Scene>
      <Panel x={X0 - 4} y={Y0 - 4} w={width + 8} h={height + 8} />
      {/* Column letters and row numbers. */}
      <g className="fill-slate-100 dark:fill-slate-700/60">
        <rect x={X0} y={Y0} width={width} height={HEAD_H} />
        <rect x={X0} y={Y0} width={HEAD_W} height={height} />
      </g>
      {COLS.map((c, i) => (
        <text
          key={c}
          className={MUTED}
          x={colX(i) + CELL_W / 2}
          y={Y0 + 7.8}
          fontSize="6"
          fontWeight="600"
          textAnchor="middle"
        >
          {c}
        </text>
      ))}
      {[...ROWS, null].map((_, i) => (
        <text
          key={i}
          className={MUTED}
          x={X0 + HEAD_W / 2}
          y={rowY(i) + 8.8}
          fontSize="6"
          fontWeight="600"
          textAnchor="middle"
        >
          {i + 1}
        </text>
      ))}
      {/* The grid lines. */}
      <g className={RULE} strokeWidth="0.7" fill="none">
        <rect x={X0} y={Y0} width={width} height={height} />
        {[...ROWS, null].map((_, i) => (
          <path key={i} d={`M${X0} ${rowY(i)} h${width}`} />
        ))}
        {COLS.map((_, i) => (
          <path key={i} d={`M${colX(i)} ${Y0} v${height}`} />
        ))}
      </g>
      {ROWS.map((row, r) =>
        row.map((cell, c) => (
          <text
            key={`${r}-${c}`}
            className={TEXT}
            x={c === 0 ? colX(c) + 4 : colX(c) + CELL_W - 4}
            y={rowY(r) + 8.8}
            fontSize="6.4"
            textAnchor={c === 0 ? 'start' : 'end'}
          >
            {cell}
          </text>
        )),
      )}
      {/* The total row: its label, the selected cell, and the sum it works out. */}
      <text className={TEXT} x={colX(0) + 4} y={totalY + 8.8} fontSize="6.4" fontWeight="700">
        Total
      </text>
      <rect
        className="fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
        x={colX(1)}
        y={totalY}
        width={CELL_W}
        height={CELL_H}
        strokeWidth="1.2"
      />
      <text
        className={`fa-a-late ${TEXT}`}
        style={at(0.4)}
        x={colX(1) + CELL_W - 4}
        y={totalY + 8.8}
        fontSize="6.4"
        fontWeight="700"
        textAnchor="end"
      >
        50
      </text>
      <text
        className={`fa-a-late ${TEXT}`}
        style={at(0.4)}
        x={colX(2) + CELL_W - 4}
        y={totalY + 8.8}
        fontSize="6.4"
        fontWeight="700"
        textAnchor="end"
      >
        15
      </text>
      {/* The formula, typed into the bar beside the grid. */}
      <g className="fa-a-in" style={at(0)}>
        <Panel x={X0 + width + 10} y={Y0 + 22} w={58} h={18} />
        <text
          className="fill-brand-600 dark:fill-brand-300"
          x={X0 + width + 16}
          y={Y0 + 33.6}
          fontSize="6.2"
          fontWeight="600"
          fontFamily="ui-monospace, monospace"
        >
          =SUM(B1:B3)
        </text>
      </g>
    </Scene>
  );
}
