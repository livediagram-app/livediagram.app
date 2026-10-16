import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The hero's Sheets window (docs/specs/019-marketing/marketing-site.md "Hero"): a budget Sheet in Plan mode
// (docs/specs/029-sheets/sheet.md) filling its tab. Its header row and lines land row by row; you select Total's
// first cell and type `=SUM(B2:D2)` in the formula bar, its value appears and fills down the column; then a teammate
// selects the totals and charts them, the bars growing over the Sheet. Every piece plays at its own --d
// (hero-mode-animations.css); a phone draws the same Sheet smaller.

// The script, in seconds.
const T = {
  grid: 0.1,
  header: 0.4,
  rows: 0.7, // first line; the rest follow 0.12s apart
  select: 2.6,
  typed: 3.0,
  value: 4.2,
  fill: 4.7, // the column fills down, 0.08s a cell
  teammate: 5.8,
  range: 6.6,
  chart: 7.1,
  bars: 7.5,
} as const;

const LINES = [
  { item: 'Rent', months: [1200, 1200, 1200] },
  { item: 'Payroll', months: [5400, 5400, 5600] },
  { item: 'Software', months: [320, 340, 360] },
  { item: 'Travel', months: [450, 120, 600] },
  { item: 'Marketing', months: [800, 950, 700] },
  { item: 'Office', months: [180, 180, 200] },
] as const;
const FORMULA = '=SUM(B2:D2)';

// Columns: the row numbers, then A (Item), B to D (the months), E (Total), F running on past the window.
// The grid fills the tab as a Sheet does: from the canvas's left edge, columns running on past its right one and
// empty rows down past its foot.
const X0 = -56;
const NUM_W = 26;
const COLS = [
  { letter: 'A', head: 'Item', w: 140 },
  { letter: 'B', head: 'Jan', w: 92 },
  { letter: 'C', head: 'Feb', w: 92 },
  { letter: 'D', head: 'Mar', w: 92 },
  { letter: 'E', head: 'Total', w: 100 },
  { letter: 'F', head: '', w: 110 },
  { letter: 'G', head: '', w: 110 },
] as const;
// Rows drawn, the budget's and the empty ones under it, enough to reach the canvas's foot.
const GRID_ROWS = 16;
const ROW_H = 22;
const TOP = -16; // the column letters' row
const colX = (c: number) => X0 + NUM_W + COLS.slice(0, c).reduce((s, col) => s + col.w, 0);
const rowY = (r: number) => TOP + 18 + r * ROW_H; // r = 0 is the header row (row 1)
const money = (n: number) => n.toLocaleString('en-US');
const totalOf = (i: number) => LINES[i]!.months.reduce((s, n) => s + n, 0);

function Cell({
  c,
  r,
  text,
  bold = false,
  right = false,
  tone = 'fill-(--art-text) dark:fill-slate-100',
}: {
  c: number;
  r: number;
  text: string;
  bold?: boolean;
  right?: boolean;
  tone?: string;
}) {
  const x = right ? colX(c) + COLS[c]!.w - 8 : colX(c) + 8;
  return (
    <text
      className={tone}
      x={x}
      y={rowY(r) + 15}
      textAnchor={right ? 'end' : 'start'}
      fontFamily={FONT}
      fontSize="10"
      fontWeight={bold ? 700 : 500}
    >
      {text}
    </text>
  );
}

function Sheet() {
  const gridW = colX(COLS.length) - X0;
  const rows = GRID_ROWS;
  const eX = colX(4);
  const eW = COLS[4].w;
  const chart = { x: 330, y: 150, w: 250, h: 136 };
  const max = Math.max(...LINES.map((_, i) => totalOf(i)));
  return (
    <>
      {/* The Sheet fills the tab: its surface, the formula bar over its grid. */}
      <rect
        className="hm-fade fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-800"
        style={at(T.grid)}
        x="-600"
        y="-56"
        width="1800"
        height="900"
        strokeWidth="0.8"
      />
      <g className="hm-fade" style={at(T.grid)}>
        <rect
          x={X0}
          y="-50"
          width="44"
          height="20"
          rx="4"
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        />
        <text
          className="hm-fade fill-slate-600 dark:fill-slate-300"
          style={at(T.select)}
          x={X0 + 22}
          y="-36"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="9.5"
          fontWeight="600"
        >
          E2
        </text>
        <text
          x={X0 + 54}
          y="-36"
          fontFamily="ui-serif, Georgia, serif"
          fontStyle="italic"
          fontSize="10"
          className="fill-slate-400"
        >
          fx
        </text>
        <text
          className="hm-type fill-(--art-text) dark:fill-slate-100"
          style={at(T.typed, { '--steps': FORMULA.length })}
          x={X0 + 70}
          y="-36"
          fontFamily="ui-monospace, monospace"
          fontSize="10"
        >
          {FORMULA}
        </text>
      </g>

      {/* The grid: column letters, row numbers and the lines between cells. */}
      <g className="hm-fade" style={at(T.grid + 0.1)}>
        <rect
          x={X0}
          y={TOP}
          width={gridW}
          height="18"
          className="fill-slate-100 dark:fill-slate-800"
        />
        <rect
          x={X0}
          y={TOP}
          width={NUM_W}
          height={18 + rows * ROW_H}
          className="fill-slate-100 dark:fill-slate-800"
        />
        {COLS.map((col, c) => (
          <text
            key={col.letter}
            x={colX(c) + col.w / 2}
            y={TOP + 12.5}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="8.5"
            fontWeight="600"
            className="fill-slate-500 dark:fill-slate-400"
          >
            {col.letter}
          </text>
        ))}
        {Array.from({ length: rows }, (_, r) => (
          <g key={r}>
            <text
              x={X0 + NUM_W / 2}
              y={rowY(r) + 14.5}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="8.5"
              className="fill-slate-500 dark:fill-slate-400"
            >
              {r + 1}
            </text>
            <path
              d={`M${X0} ${rowY(r) + ROW_H}H${X0 + gridW}`}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="0.7"
            />
          </g>
        ))}
        {COLS.map((col, c) => (
          <path
            key={col.letter}
            d={`M${colX(c)} ${TOP}V${rowY(rows)}`}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="0.7"
          />
        ))}
      </g>

      {/* Row 1, the headers, bold and frozen; then the budget's lines, row by row. */}
      <g className="hm-fade" style={at(T.header)}>
        {COLS.slice(0, 5).map((col, c) => (
          <Cell key={col.head} c={c} r={0} text={col.head} bold right={c > 0} />
        ))}
      </g>
      {LINES.map((line, i) => (
        <g key={line.item} className="hm-pop" style={at(T.rows + i * 0.12)}>
          <Cell c={0} r={i + 1} text={line.item} />
          {line.months.map((n, m) => (
            <Cell key={m} c={m + 1} r={i + 1} text={money(n)} right />
          ))}
        </g>
      ))}

      {/* You select Total's first cell, type its formula, and it fills down. */}
      <rect
        className="hm-fade"
        style={at(T.select)}
        x={eX}
        y={rowY(1)}
        width={eW}
        height={ROW_H}
        fill="none"
        stroke={YOU}
        strokeWidth="2"
      />
      {LINES.map((_, i) => (
        <g key={i} className="hm-pop" style={at(i === 0 ? T.value : T.fill + i * 0.08)}>
          <Cell c={4} r={i + 1} text={money(totalOf(i))} right bold />
        </g>
      ))}
      <g
        className="hm-cursor"
        style={at(T.select - 0.6, {
          '--sx': '200px',
          '--sy': '220px',
          '--cx': `${eX + eW - 14}px`,
          '--cy': `${rowY(1) + 14}px`,
        })}
        aria-hidden
      >
        <CursorMark colour={YOU} label="You" badge="name" />
      </g>

      {/* A teammate selects the totals and charts them: the bars grow over the Sheet. */}
      <rect
        className="hm-fade"
        style={at(T.range)}
        x={eX}
        y={rowY(1)}
        width={eW}
        height={ROW_H * LINES.length}
        fill={TEAMMATE}
        fillOpacity="0.08"
        stroke={TEAMMATE}
        strokeWidth="1.5"
      />
      <g className="hm-pop" style={at(T.chart)}>
        <rect
          x={chart.x}
          y={chart.y}
          width={chart.w}
          height={chart.h}
          rx="8"
          className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
          style={{ filter: 'drop-shadow(0 6px 10px rgb(15 23 42 / 0.12))' }}
        />
        <text
          x={chart.x + 12}
          y={chart.y + 20}
          fontFamily={FONT}
          fontSize="10"
          fontWeight="700"
          className="fill-(--art-text) dark:fill-slate-100"
        >
          Total by line
        </text>
      </g>
      {LINES.map((line, i) => {
        const h = Math.max(4, (totalOf(i) / max) * 92);
        const bw = 26;
        const x = chart.x + 18 + i * 37;
        const base = chart.y + chart.h - 18;
        return (
          <g key={line.item}>
            <rect
              className="hm-grow"
              style={at(T.bars + i * 0.08)}
              x={x}
              y={base - h}
              width={bw}
              height={h}
              rx="3"
              fill={i === 1 ? '#7c3aed' : '#0ea5e9'}
            />
            <text
              className="hm-fade fill-slate-500 dark:fill-slate-400"
              style={at(T.bars + i * 0.08)}
              x={x + bw / 2}
              y={base + 11}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="7.5"
            >
              {line.item.slice(0, 4)}
            </text>
          </g>
        );
      })}
      {/* The teammate's cursor last, so the chart never covers it. */}
      <g
        className="hm-cursor"
        style={at(T.teammate, {
          '--sx': '620px',
          '--sy': '320px',
          '--cx': `${eX + eW - 10}px`,
          '--cy': `${rowY(LINES.length) + 16}px`,
        })}
        aria-hidden
      >
        <CursorMark colour={TEAMMATE} label="Maya" badge="name" />
      </g>
    </>
  );
}

export function SheetBoard({ portrait = false }: { portrait?: boolean }) {
  // A phone draws the same Sheet smaller, its right columns running past the screen's edge as a phone scrolls them.
  return portrait ? (
    <g transform="translate(-6 40) scale(0.66)">
      <Sheet />
    </g>
  ) : (
    <Sheet />
  );
}
