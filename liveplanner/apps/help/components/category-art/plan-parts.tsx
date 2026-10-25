// liveplanner's work in miniature, for the shared scenes that draw a product's work into a box (a device's screen,
// a synced thumbnail, what the API made): a board of cards in columns and a sheet of rows. Each scales to the box
// it is handed, so it reads the same on a laptop and in a thumbnail.

type Box = { x: number; y: number; w: number; h: number };

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
