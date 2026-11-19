// Feature illustration: a Sheet on a Plan tab (the Plans & boards category's spreadsheet card).
// A small grid with lettered columns and numbered rows, a formula typing into the total cell and
// its answer landing. Motion reuses the canvas card timeline (fa-a-* in
// app/feature-art/canvas.css), which settles to the finished frame under reduced motion.
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

/** Charts from your cells: the months and signups selected, and the Column Chart made from them sitting in the
 *  Sheet over its cells, selected with its corner handle; one figure changes and its bar follows. */
export function SheetChartArt() {
  const months = [
    ['Jun', 318],
    ['Jul', 412],
    ['Aug', 488],
    ['Sep', 531],
  ] as const;
  const x0 = 14;
  const y0 = 8;
  const colW = [12, 34, 34];
  const rowH = 13;
  const colX = [x0, x0 + colW[0]!, x0 + colW[0]! + colW[1]!];
  const right = x0 + colW[0]! + colW[1]! + colW[2]!;
  const bar = (n: number) => (n / 560) * 40;
  return (
    <Scene>
      <Panel x={x0 - 4} y={y0 - 4} w={282} h={88} />
      {/* Column letters and row numbers. */}
      <g className="fill-slate-100 dark:fill-slate-700/60">
        <rect x={x0} y={y0} width={276} height={9} />
        <rect x={x0} y={y0} width={colW[0]} height={9 + 5 * rowH + 6} />
      </g>
      {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c, i) => (
        <text
          key={c}
          className={MUTED}
          x={colX[1]! + 17 + i * 34}
          y={y0 + 6.6}
          fontSize="5"
          fontWeight="600"
          textAnchor="middle"
        >
          {c}
        </text>
      ))}
      <g className={RULE} strokeWidth="0.6" fill="none">
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <path key={r} d={`M${x0} ${y0 + 9 + r * rowH} H${x0 + 276}`} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <path key={c} d={`M${colX[1]! + c * 34} ${y0} V${y0 + 9 + 5 * rowH + 6}`} />
        ))}
      </g>
      {[1, 2, 3, 4, 5].map((r) => (
        <text
          key={r}
          className={MUTED}
          x={x0 + 6}
          y={y0 + 9 + (r - 1) * rowH + 8.8}
          fontSize="5"
          textAnchor="middle"
        >
          {r}
        </text>
      ))}
      <text className={TEXT} x={colX[1]! + 3} y={y0 + 17.8} fontSize="5.6" fontWeight="700">
        Month
      </text>
      <text
        className={TEXT}
        x={right - 3}
        y={y0 + 17.8}
        fontSize="5.6"
        fontWeight="700"
        textAnchor="end"
      >
        Signups
      </text>
      {months.map(([m, n], i) => {
        const y = y0 + 9 + (i + 1) * rowH + 8.8;
        return (
          <g key={m}>
            <text className={TEXT} x={colX[1]! + 3} y={y} fontSize="5.6">
              {m}
            </text>
            {i === 3 ? (
              <g>
                <text
                  className={`fa-a-out ${TEXT}`}
                  style={at(0.3)}
                  x={right - 3}
                  y={y}
                  fontSize="5.6"
                  textAnchor="end"
                >
                  474
                </text>
                <text
                  className={`fa-a-late ${TEXT}`}
                  style={at(0.3)}
                  x={right - 3}
                  y={y}
                  fontSize="5.6"
                  textAnchor="end"
                >
                  {n}
                </text>
              </g>
            ) : (
              <text className={TEXT} x={right - 3} y={y} fontSize="5.6" textAnchor="end">
                {n}
              </text>
            )}
          </g>
        );
      })}
      {/* The charted range, A1:B5. */}
      <rect
        x={colX[1]}
        y={y0 + 9}
        width={68}
        height={5 * rowH}
        className="fill-brand-500/[0.07] stroke-brand-500 dark:stroke-brand-400"
        strokeWidth="1"
      />
      {/* The chart, over the cells beside the range, selected. */}
      <Panel x={136} y={21} w={146} h={65} />
      <rect
        x={136}
        y={21}
        width={146}
        height={65}
        rx="6"
        fill="none"
        className="stroke-brand-500"
        strokeWidth="1"
      />
      <rect
        x={279}
        y={83}
        width="5"
        height="5"
        rx="1"
        className="fill-white stroke-brand-500 dark:fill-slate-800"
        strokeWidth="0.8"
      />
      <text className={TEXT} x={144} y={31} fontSize="5.8" fontWeight="700">
        Signups
      </text>
      <path className={RULE} d="M150 76.5 H274" strokeWidth="0.7" />
      {[38, 51, 64].map((y) => (
        <path
          key={y}
          className={RULE}
          d={`M150 ${y} H274`}
          strokeWidth="0.4"
          strokeDasharray="1.5 1.5"
        />
      ))}
      {months.map(([m, n], i) => {
        const x = 158 + i * 30;
        const h = bar(n);
        return (
          <g key={m}>
            {i === 3 ? (
              <g>
                <rect
                  className="fa-a-out"
                  style={at(0.3)}
                  x={x}
                  y={76.5 - bar(474)}
                  width="14"
                  height={bar(474)}
                  rx="1.5"
                  fill="#8b5cf6"
                />
                <rect
                  className="fa-a-late"
                  style={at(0.3)}
                  x={x}
                  y={76.5 - h}
                  width="14"
                  height={h}
                  rx="1.5"
                  fill="#8b5cf6"
                />
              </g>
            ) : (
              <rect x={x} y={76.5 - h} width="14" height={h} rx="1.5" fill="#8b5cf6" />
            )}
            <text className={MUTED} x={x + 7} y={83} fontSize="4.6" textAnchor="middle">
              {m}
            </text>
          </g>
        );
      })}
    </Scene>
  );
}
