// liveplanner's work in miniature: a board, a sheet, a dashboard and a form. In work-art's house style and contract (work-art.tsx):
// each draws into the box it is handed, in SVG user units, static, with no colour of its own.

import { Bar, Paper, type WorkBox } from './work-art-parts';

type Box = WorkBox;

// ---- liveplanner -----------------------------------------------------------------------------------------------

// The columns' head dots, and the tags on each column's cards, To do to Done.
const COLUMNS = [
  { head: 'fill-slate-300', tags: ['fill-amber-300', 'fill-sky-300', 'fill-emerald-300'] },
  { head: 'fill-amber-400', tags: ['fill-sky-300', 'fill-rose-300'] },
  { head: 'fill-emerald-400', tags: ['fill-emerald-300'] },
];

/** A board: three columns of cards, To do, Doing and Done, with the header's done count above them. */
export function MiniBoard({ x, y, w, h, header = true }: Box & { header?: boolean }) {
  const pad = Math.max(2, w * 0.04);
  const top = header ? y + h * 0.16 : y + pad;
  const gap = Math.max(1.5, w * 0.03);
  const colW = (w - pad * 2 - gap * 2) / 3;
  const colH = y + h - pad - top;
  const cardH = Math.min(colH * 0.24, colW * 0.62);
  const line = Math.max(1, cardH * 0.16);
  return (
    <g>
      {header && (
        <>
          <rect
            x={x + pad}
            y={y + h * 0.05}
            width={w * 0.28}
            height={Math.max(1.5, h * 0.045)}
            rx={1}
            className="fill-slate-400"
          />
          <rect
            x={x + w * 0.62}
            y={y + h * 0.05}
            width={w * 0.34}
            height={Math.max(1.5, h * 0.045)}
            rx={1}
            className="fill-slate-100"
          />
          <rect
            x={x + w * 0.62}
            y={y + h * 0.05}
            width={w * 0.2}
            height={Math.max(1.5, h * 0.045)}
            rx={1}
            className="fill-brand-400"
          />
        </>
      )}
      {COLUMNS.map((col, c) => {
        const cx = x + pad + c * (colW + gap);
        return (
          <g key={c}>
            <rect
              x={cx}
              y={top}
              width={colW}
              height={colH}
              rx={Math.min(3, colW * 0.08)}
              className="fill-slate-50"
            />
            <circle
              cx={cx + colW * 0.16}
              cy={top + cardH * 0.32}
              r={Math.max(0.8, colW * 0.06)}
              className={col.head}
            />
            <rect
              x={cx + colW * 0.28}
              y={top + cardH * 0.32 - line / 2}
              width={colW * 0.4}
              height={line}
              rx={line / 2}
              className="fill-slate-300"
            />
            {col.tags.map((tag, i) => {
              const cy = top + cardH * 0.7 + i * (cardH + gap);
              return (
                <g key={i}>
                  <rect
                    x={cx + colW * 0.08}
                    y={cy}
                    width={colW * 0.84}
                    height={cardH}
                    rx={Math.min(2.5, cardH * 0.18)}
                    className="fill-white stroke-slate-200"
                    strokeWidth={0.8}
                  />
                  <rect
                    x={cx + colW * 0.18}
                    y={cy + cardH * 0.24}
                    width={colW * 0.56}
                    height={line}
                    rx={line / 2}
                    className="fill-slate-300"
                  />
                  <rect
                    x={cx + colW * 0.18}
                    y={cy + cardH * 0.58}
                    width={colW * 0.3}
                    height={line}
                    rx={line / 2}
                    className={tag}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** A sheet: a header row in the brand tint, then rows of cells with a status pill in the last column. */
export function MiniSheet({ x, y, w, h }: Box) {
  const rows = 5;
  const rowH = h / rows;
  const cols = [0.42, 0.26, 0.32];
  const pills = ['fill-emerald-300', 'fill-amber-300', 'fill-emerald-300', 'fill-sky-300'];
  const line = Math.max(1, rowH * 0.2);
  let left = x;
  const lefts = cols.map((f) => {
    const l = left;
    left += f * w;
    return l;
  });
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className="fill-white stroke-slate-200"
        strokeWidth={0.8}
      />
      <rect x={x} y={y} width={w} height={rowH} className="fill-brand-100" />
      {lefts.map((l, c) => (
        <rect
          key={c}
          x={l + w * 0.03}
          y={y + rowH / 2 - line / 2}
          width={cols[c]! * w * 0.5}
          height={line}
          rx={line / 2}
          className="fill-brand-400"
        />
      ))}
      {pills.map((pill, r) => {
        const ry = y + rowH * (r + 1);
        return (
          <g key={r}>
            <line
              x1={x}
              y1={ry}
              x2={x + w}
              y2={ry}
              className="stroke-slate-200"
              strokeWidth={0.6}
            />
            <rect
              x={lefts[0]! + w * 0.03}
              y={ry + rowH / 2 - line / 2}
              width={w * (r % 2 ? 0.24 : 0.3)}
              height={line}
              rx={line / 2}
              className="fill-slate-300"
            />
            <rect
              x={lefts[1]! + w * 0.03}
              y={ry + rowH / 2 - line / 2}
              width={w * 0.12}
              height={line}
              rx={line / 2}
              className="fill-slate-200"
            />
            <rect
              x={lefts[2]! + w * 0.04}
              y={ry + rowH * 0.25}
              width={w * 0.22}
              height={rowH * 0.5}
              rx={rowH * 0.25}
              className={pill}
            />
          </g>
        );
      })}
      {lefts.slice(1).map((l, c) => (
        <line
          key={c}
          x1={l}
          y1={y}
          x2={l}
          y2={y + h}
          className="stroke-slate-200"
          strokeWidth={0.6}
        />
      ))}
    </g>
  );
}

/** A dashboard: three metric tiles, a line chart and a column chart, on one page. */
export function MiniDashboard({ x, y, w, h }: Box) {
  const pad = Math.max(2, w * 0.05);
  const gap = Math.max(1.5, w * 0.035);
  const tileW = (w - pad * 2 - gap * 2) / 3;
  const tileH = h * 0.24;
  const line = Math.max(1, h * 0.035);
  const chartY = y + pad + tileH + gap;
  const chartH = y + h - pad - chartY;
  const leftW = (w - pad * 2 - gap) * 0.58;
  const rightX = x + pad + leftW + gap;
  const rightW = w - pad * 2 - leftW - gap;
  const pts = [0.7, 0.55, 0.62, 0.38, 0.45, 0.2];
  const path = pts
    .map((p, i) => {
      const px = x + pad + leftW * 0.08 + (i * leftW * 0.84) / (pts.length - 1);
      const py = chartY + chartH * 0.12 + p * chartH * 0.72;
      return `${i ? 'L' : 'M'}${px} ${py}`;
    })
    .join(' ');
  const bars = [0.45, 0.7, 0.55, 0.9];
  const barW = (rightW * 0.7) / bars.length;
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      {[0, 1, 2].map((i) => {
        const tx = x + pad + i * (tileW + gap);
        return (
          <g key={i}>
            <rect
              x={tx}
              y={y + pad}
              width={tileW}
              height={tileH}
              rx={Math.min(2.5, tileW * 0.08)}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={0.6}
            />
            <Bar x={tx + tileW * 0.14} y={y + pad + tileH * 0.22} w={tileW * 0.5} h={line} />
            <Bar
              x={tx + tileW * 0.14}
              y={y + pad + tileH * 0.52}
              w={tileW * (i === 1 ? 0.42 : 0.6)}
              h={line * 1.8}
              className={i === 0 ? 'fill-brand-500' : 'fill-slate-400'}
            />
          </g>
        );
      })}
      <rect
        x={x + pad}
        y={chartY}
        width={leftW}
        height={chartH}
        rx={Math.min(2.5, leftW * 0.05)}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={0.6}
      />
      <path
        d={path}
        className="fill-none stroke-brand-500"
        strokeWidth={Math.max(1, h * 0.03)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={rightX}
        y={chartY}
        width={rightW}
        height={chartH}
        rx={Math.min(2.5, rightW * 0.06)}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={0.6}
      />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={rightX + rightW * 0.15 + i * barW}
          y={chartY + chartH * 0.88 - b * chartH * 0.7}
          width={barW * 0.7}
          height={b * chartH * 0.7}
          rx={Math.min(1.2, barW * 0.2)}
          className={i === bars.length - 1 ? 'fill-brand-500' : 'fill-brand-200'}
        />
      ))}
    </g>
  );
}

/** A form: a header band in the brand, its title, three questions with their answer boxes and a send button. */
export function MiniForm({ x, y, w, h }: Box) {
  const pad = w * 0.1;
  const line = Math.max(1, h * 0.035);
  const band = h * 0.12;
  const fieldH = h * 0.1;
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <path
        d={`M${x} ${y + 3}a3 3 0 0 1 3 -3H${x + w - 3}a3 3 0 0 1 3 3V${y + band}H${x}Z`}
        className="fill-brand-500"
      />
      <Bar
        x={x + pad}
        y={y + band + h * 0.06}
        w={w * 0.46}
        h={line * 1.6}
        className="fill-slate-700"
      />
      {[0, 1, 2].map((i) => {
        const fy = y + band + h * 0.18 + i * h * 0.18;
        return (
          <g key={i}>
            <Bar
              x={x + pad}
              y={fy}
              w={w * (i === 1 ? 0.3 : 0.38)}
              h={line}
              className="fill-slate-300"
            />
            <rect
              x={x + pad}
              y={fy + line * 2}
              width={w - pad * 2}
              height={fieldH}
              rx={Math.min(2, fieldH * 0.25)}
              className="fill-white stroke-slate-300"
              strokeWidth={0.7}
            />
          </g>
        );
      })}
      <rect
        x={x + pad}
        y={y + h - h * 0.06 - h * 0.1}
        width={w * 0.3}
        height={h * 0.1}
        rx={h * 0.05}
        className="fill-brand-500"
      />
    </g>
  );
}
