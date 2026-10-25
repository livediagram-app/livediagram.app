// Every product's work in miniature: a board, a sheet, a dashboard and a form (liveplanner), a flowchart, a mind map,
// a whiteboard and a workshop (livediagram), an article, a slide, an infographic and a poster (livedocuments), a logo,
// a phone and a website wireframe and a photo (livedesign). Each draws into the box it is handed, in SVG user units,
// and scales to it, so it reads the same on a laptop's screen in a help scene and in a tile on Explorer Home.
//
// Drawn in the house style of the help centres' illustration kit (@liveworkspace/help-site art/primitives): white
// paper with slate edges and ink, the `brand` ramp for accents. They hold no colour of their own: whoever draws them
// sets the ramp (a help centre's own; an Explorer tile its app's, explorer.css `.lw-work-art`) and turns them for dark
// (help-art.css, or `.lw-work-art`). `help-art-as-drawn` marks a part whose colour is its identity in both
// appearances. Static: no state, no effects, no motion. The help centres and the Explorer's hero share them
// (liveworkspace/docs/one-explorer.md "What you can make, on Home's hero").

export type WorkBox = { x: number; y: number; w: number; h: number };
type Box = WorkBox;

/** The box of a given width-to-height ratio, as large as fits in `box`, centred in it. */
export function fitBox(box: WorkBox, ratio: number): WorkBox {
  const w = Math.min(box.w, box.h * ratio);
  const h = w / ratio;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** A sheet of paper: white with a slate edge, the ground most pictures draw on. */
function Paper({ x, y, w, h }: Box) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={Math.min(3, w * 0.04)}
      className="fill-white stroke-slate-200"
      strokeWidth={0.8}
    />
  );
}

/** A muted bar standing in for a run of text. */
function Bar({ x, y, w, h, className = 'fill-slate-200' }: Box & { className?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} className={className} />;
}

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

// ---- livediagram -----------------------------------------------------------------------------------------------

/** A flowchart: a start, a step, a decision and its two outcomes, joined by elbow lines. */
export function MiniFlowchart({ x, y, w, h }: Box) {
  const cx = x + w / 2;
  const nodeW = w * 0.3;
  const nodeH = h * 0.15;
  const sw = Math.max(0.8, h * 0.018);
  const startY = y + h * 0.07;
  const stepY = y + h * 0.3;
  const dy = y + h * 0.6;
  const dr = h * 0.1;
  const endY = y + h * 0.78;
  const leftX = x + w * 0.08;
  const rightX = x + w - w * 0.08 - nodeW;
  const text = Math.max(1.2, nodeH * 0.18);
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <g className="fill-none stroke-slate-300" strokeWidth={sw}>
        <path d={`M${cx} ${startY + nodeH} V${stepY}`} />
        <path d={`M${cx} ${stepY + nodeH} V${dy - dr}`} />
        <path d={`M${cx - dr * 1.4} ${dy} H${leftX + nodeW / 2} V${endY}`} />
        <path d={`M${cx + dr * 1.4} ${dy} H${rightX + nodeW / 2} V${endY}`} />
      </g>
      <rect
        x={cx - nodeW / 2}
        y={startY}
        width={nodeW}
        height={nodeH}
        rx={nodeH / 2}
        className="fill-brand-500"
      />
      {[
        { nx: cx - nodeW / 2, ny: stepY },
        { nx: leftX, ny: endY },
        { nx: rightX, ny: endY },
      ].map(({ nx, ny }, i) => (
        <g key={i}>
          <rect
            x={nx}
            y={ny}
            width={nodeW}
            height={nodeH}
            rx={Math.min(2, nodeH * 0.2)}
            className="fill-white stroke-brand-300"
            strokeWidth={sw * 1.2}
          />
          <Bar
            x={nx + nodeW * 0.2}
            y={ny + nodeH / 2 - text / 2}
            w={nodeW * 0.6}
            h={text}
            className="fill-slate-300"
          />
        </g>
      ))}
      <path
        d={`M${cx} ${dy - dr} L${cx + dr * 1.4} ${dy} L${cx} ${dy + dr} L${cx - dr * 1.4} ${dy} Z`}
        className="fill-brand-100 stroke-brand-400"
        strokeWidth={sw * 1.2}
      />
    </g>
  );
}

/** A mind map: a central idea in the brand and branches curving out to their topics on either side. */
export function MiniMindMap({ x, y, w, h }: Box) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const coreW = w * 0.28;
  const coreH = h * 0.2;
  const topicW = w * 0.2;
  const topicH = h * 0.12;
  const sw = Math.max(0.8, h * 0.02);
  const text = Math.max(1.2, topicH * 0.2);
  const topics = [
    { tx: x + w * 0.06, ty: y + h * 0.14, tone: 'fill-brand-100' },
    { tx: x + w * 0.06, ty: y + h * 0.44, tone: 'fill-amber-100' },
    { tx: x + w * 0.06, ty: y + h * 0.74, tone: 'fill-emerald-100' },
    { tx: x + w * 0.74, ty: y + h * 0.2, tone: 'fill-violet-100' },
    { tx: x + w * 0.74, ty: y + h * 0.66, tone: 'fill-brand-100' },
  ];
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <g className="fill-none stroke-brand-300" strokeWidth={sw} strokeLinecap="round">
        {topics.map(({ tx, ty }, i) => {
          const left = tx < cx;
          const ex = left ? tx + topicW : tx;
          const ey = ty + topicH / 2;
          const sx = left ? cx - coreW / 2 : cx + coreW / 2;
          const mx = (sx + ex) / 2;
          return <path key={i} d={`M${sx} ${cy} C${mx} ${cy} ${mx} ${ey} ${ex} ${ey}`} />;
        })}
      </g>
      {topics.map(({ tx, ty, tone }, i) => (
        <g key={i}>
          <rect x={tx} y={ty} width={topicW} height={topicH} rx={topicH / 2} className={tone} />
          <Bar
            x={tx + topicW * 0.2}
            y={ty + topicH / 2 - text / 2}
            w={topicW * 0.6}
            h={text}
            className="fill-slate-400"
          />
        </g>
      ))}
      <rect
        x={cx - coreW / 2}
        y={cy - coreH / 2}
        width={coreW}
        height={coreH}
        rx={coreH / 2}
        className="fill-brand-500"
      />
      <Bar
        x={cx - coreW * 0.3}
        y={cy - Math.max(0.8, coreH * 0.09)}
        w={coreW * 0.6}
        h={Math.max(1.6, coreH * 0.18)}
        className="fill-white help-art-as-drawn"
      />
    </g>
  );
}

/** A whiteboard: the canvas's dot grid, a loop of freehand ink in the brand, a sticky note and a sketched arrow. */
export function MiniWhiteboard({ x, y, w, h }: Box) {
  const sw = Math.max(1, h * 0.03);
  const step = Math.max(6, w / 9);
  const dots: { cx: number; cy: number }[] = [];
  for (let dx = step / 2; dx < w; dx += step)
    for (let dy = step / 2; dy < h; dy += step) dots.push({ cx: x + dx, cy: y + dy });
  const s = Math.min(w * 0.3, h * 0.42);
  const sx = x + w * 0.6;
  const sy = y + h * 0.14;
  const text = Math.max(1, s * 0.08);
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={Math.max(0.5, w * 0.006)}
          className="fill-slate-200"
        />
      ))}
      <path
        d={`M${x + w * 0.1} ${y + h * 0.62} C${x + w * 0.12} ${y + h * 0.2} ${x + w * 0.42} ${y + h * 0.16} ${x + w * 0.46} ${y + h * 0.44} S${x + w * 0.2} ${y + h * 0.78} ${x + w * 0.3} ${y + h * 0.84} S${x + w * 0.5} ${y + h * 0.7} ${x + w * 0.56} ${y + h * 0.8}`}
        className="fill-none stroke-brand-500"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={sx}
        y={sy}
        width={s}
        height={s}
        rx={Math.min(1.5, s * 0.05)}
        className="fill-amber-200"
      />
      <Bar
        x={sx + s * 0.14}
        y={sy + s * 0.22}
        w={s * 0.62}
        h={text}
        className="fill-amber-600/50"
      />
      <Bar
        x={sx + s * 0.14}
        y={sy + s * 0.42}
        w={s * 0.46}
        h={text}
        className="fill-amber-600/50"
      />
      <path
        d={`M${x + w * 0.62} ${y + h * 0.88} Q${x + w * 0.8} ${y + h * 0.9} ${sx + s * 0.5} ${sy + s + h * 0.06}`}
        className="fill-none stroke-slate-400"
        strokeWidth={sw * 0.7}
        strokeLinecap="round"
      />
      <path
        d={`M${sx + s * 0.36} ${sy + s + h * 0.12} L${sx + s * 0.5} ${sy + s + h * 0.05} L${sx + s * 0.62} ${sy + s + h * 0.13}`}
        className="fill-none stroke-slate-400"
        strokeWidth={sw * 0.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A workshop: a timer counting down over a row of sticky notes, two of them with votes on. */
export function MiniWorkshop({ x, y, w, h }: Box) {
  const pad = w * 0.08;
  const r = Math.min(w, h) * 0.13;
  const tcx = x + w - pad - r;
  const tcy = y + pad * 0.6 + r;
  const sw = Math.max(1, r * 0.28);
  const gap = w * 0.04;
  const noteW = (w - pad * 2 - gap * 2) / 3;
  const noteY = y + h * 0.46;
  const noteH = Math.min(noteW, h * 0.44);
  const notes = ['fill-amber-200', 'fill-sky-200', 'fill-emerald-200'];
  const votes = [2, 0, 1];
  const arc = 2 * Math.PI * r;
  const text = Math.max(1, noteH * 0.08);
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <Bar
        x={x + pad}
        y={y + pad}
        w={w * 0.36}
        h={Math.max(1.4, h * 0.05)}
        className="fill-slate-700"
      />
      <Bar
        x={x + pad}
        y={y + pad + h * 0.1}
        w={w * 0.24}
        h={Math.max(1, h * 0.035)}
        className="fill-slate-300"
      />
      <circle cx={tcx} cy={tcy} r={r} className="fill-none stroke-brand-100" strokeWidth={sw} />
      <circle
        cx={tcx}
        cy={tcy}
        r={r}
        className="fill-none stroke-brand-500"
        strokeWidth={sw}
        strokeDasharray={`${arc * 0.68} ${arc}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${tcx} ${tcy})`}
      />
      {notes.map((tone, i) => {
        const nx = x + pad + i * (noteW + gap);
        return (
          <g key={i}>
            <rect
              x={nx}
              y={noteY}
              width={noteW}
              height={noteH}
              rx={Math.min(1.5, noteW * 0.05)}
              className={tone}
            />
            <Bar
              x={nx + noteW * 0.14}
              y={noteY + noteH * 0.2}
              w={noteW * 0.66}
              h={text}
              className="fill-slate-600/40"
            />
            <Bar
              x={nx + noteW * 0.14}
              y={noteY + noteH * 0.38}
              w={noteW * 0.46}
              h={text}
              className="fill-slate-600/40"
            />
            {Array.from({ length: votes[i]! }, (_, v) => (
              <circle
                key={v}
                cx={nx + noteW * (0.24 + v * 0.22)}
                cy={noteY + noteH * 0.76}
                r={Math.max(1, noteW * 0.08)}
                className="fill-brand-500"
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

// ---- livedocuments ---------------------------------------------------------------------------------------------

/** An article page: a heading in the brand, a picture, then paragraphs of text lines. */
export function MiniArticle({ x, y, w, h }: Box) {
  const pad = w * 0.1;
  const line = Math.max(1, h * 0.035);
  const gap = line * 2.1;
  const rows = Math.max(2, Math.floor((h * 0.52) / gap));
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={Math.min(3, w * 0.04)}
        className="fill-white stroke-slate-200"
        strokeWidth={0.8}
      />
      <rect
        x={x + pad}
        y={y + h * 0.08}
        width={w * 0.55}
        height={line * 1.8}
        rx={line * 0.9}
        className="fill-brand-500"
      />
      <rect
        x={x + pad}
        y={y + h * 0.18}
        width={w - pad * 2}
        height={h * 0.2}
        rx={Math.min(2, w * 0.03)}
        className="fill-brand-100"
      />
      <path
        d={`M${x + pad + w * 0.06} ${y + h * 0.35} l${w * 0.14} ${-h * 0.09} ${w * 0.1} ${h * 0.05} ${w * 0.16} ${-h * 0.1} ${w * 0.2} ${h * 0.14}`}
        className="fill-none stroke-brand-300"
        strokeWidth={Math.max(0.8, line * 0.7)}
        strokeLinejoin="round"
      />
      {Array.from({ length: rows }, (_, i) => (
        <rect
          key={i}
          x={x + pad}
          y={y + h * 0.45 + i * gap}
          width={(w - pad * 2) * (i === rows - 1 ? 0.55 : i % 3 === 2 ? 0.86 : 1)}
          height={line}
          rx={line / 2}
          className="fill-slate-200"
        />
      ))}
    </g>
  );
}

/** A slide: a 16:9 page with its title, a line under it, and a column chart. */
export function MiniSlide({ x, y, w, h }: Box) {
  const sh = Math.min(h, w * 0.5625);
  const sy = y + (h - sh) / 2;
  const pad = w * 0.08;
  const line = Math.max(1, sh * 0.06);
  const bars = [0.38, 0.6, 0.48, 0.82];
  const base = sy + sh * 0.86;
  const barW = (w * 0.38) / bars.length;
  return (
    <g>
      <rect
        x={x}
        y={sy}
        width={w}
        height={sh}
        rx={Math.min(3, w * 0.03)}
        className="fill-white stroke-slate-200"
        strokeWidth={0.8}
      />
      <rect x={x} y={sy} width={w * 0.04} height={sh} className="fill-brand-500" />
      <rect
        x={x + pad}
        y={sy + sh * 0.18}
        width={w * 0.4}
        height={line * 1.6}
        rx={line * 0.8}
        className="fill-slate-700"
      />
      <rect
        x={x + pad}
        y={sy + sh * 0.18 + line * 3}
        width={w * 0.3}
        height={line}
        rx={line / 2}
        className="fill-slate-300"
      />
      <rect
        x={x + pad}
        y={sy + sh * 0.18 + line * 5}
        width={w * 0.24}
        height={line}
        rx={line / 2}
        className="fill-slate-300"
      />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={x + w * 0.54 + i * barW * 1.15}
          y={base - b * sh * 0.62}
          width={barW * 0.85}
          height={b * sh * 0.62}
          rx={Math.min(1.5, barW * 0.2)}
          className={i === bars.length - 1 ? 'fill-brand-500' : 'fill-brand-200'}
        />
      ))}
    </g>
  );
}

/** An infographic: a portrait page with a heading, a big figure, a ring chart and a few rows of icon and text. */
export function MiniInfographic(box: Box) {
  const { x, y, w, h } = fitBox(box, 0.72);
  const pad = w * 0.12;
  const line = Math.max(1, h * 0.03);
  const r = w * 0.15;
  const rcx = x + w - pad - r;
  const rcy = y + h * 0.36;
  const sw = Math.max(1.2, r * 0.42);
  const arc = 2 * Math.PI * r;
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <Bar x={x + pad} y={y + h * 0.08} w={w * 0.6} h={line * 1.7} className="fill-slate-700" />
      <Bar
        x={x + pad}
        y={y + h * 0.08 + line * 3}
        w={w * 0.4}
        h={line}
        className="fill-slate-300"
      />
      <rect
        x={x + pad}
        y={y + h * 0.27}
        width={w * 0.3}
        height={h * 0.1}
        rx={Math.min(2, h * 0.02)}
        className="fill-brand-500"
      />
      <Bar x={x + pad} y={y + h * 0.42} w={w * 0.32} h={line} className="fill-slate-300" />
      <circle cx={rcx} cy={rcy} r={r} className="fill-none stroke-brand-100" strokeWidth={sw} />
      <circle
        cx={rcx}
        cy={rcy}
        r={r}
        className="fill-none stroke-brand-500"
        strokeWidth={sw}
        strokeDasharray={`${arc * 0.62} ${arc}`}
        transform={`rotate(-90 ${rcx} ${rcy})`}
      />
      {[0, 1, 2].map((i) => {
        const ry = y + h * (0.6 + i * 0.12);
        return (
          <g key={i}>
            <circle
              cx={x + pad + line * 1.6}
              cy={ry + line / 2}
              r={line * 1.6}
              className={i === 0 ? 'fill-brand-400' : 'fill-brand-200'}
            />
            <Bar
              x={x + pad + line * 4.5}
              y={ry}
              w={(w - pad * 2 - line * 4.5) * (i === 2 ? 0.6 : 0.9)}
              h={line}
            />
          </g>
        );
      })}
    </g>
  );
}

/** A poster: a portrait page with a block of colour holding its headline, a sun rising behind, and the date below. */
export function MiniPoster(box: Box) {
  const { x, y, w, h } = fitBox(box, 0.72);
  const pad = w * 0.12;
  const line = Math.max(1, h * 0.035);
  const blockH = h * 0.6;
  const r = Math.min(3, w * 0.04);
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <path
        d={`M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + blockH}H${x}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}Z`}
        className="fill-brand-500"
      />
      <circle cx={x + w * 0.68} cy={y + blockH * 0.4} r={w * 0.2} className="fill-brand-300" />
      <Bar
        x={x + pad}
        y={y + blockH * 0.66}
        w={w * 0.66}
        h={line * 1.8}
        className="fill-white help-art-as-drawn"
      />
      <Bar
        x={x + pad}
        y={y + blockH * 0.66 + line * 2.8}
        w={w * 0.44}
        h={line * 1.8}
        className="fill-white help-art-as-drawn"
      />
      <Bar
        x={x + pad}
        y={y + blockH + h * 0.1}
        w={w * 0.3}
        h={line * 1.4}
        className="fill-slate-700"
      />
      <Bar
        x={x + pad}
        y={y + blockH + h * 0.1 + line * 3}
        w={w * 0.56}
        h={line}
        className="fill-slate-300"
      />
      <Bar
        x={x + pad}
        y={y + blockH + h * 0.1 + line * 5}
        w={w * 0.4}
        h={line}
        className="fill-slate-300"
      />
    </g>
  );
}

// ---- livedesign ------------------------------------------------------------------------------------------------

/** A logo artboard: a square page, its construction circle and centre lines, and the mark (a triangle with a dot). */
export function MiniLogo({ x, y, w, h }: Box) {
  const s = Math.min(w, h);
  const ox = x + (w - s) / 2;
  const oy = y + (h - s) / 2;
  const cx = ox + s / 2;
  const cy = oy + s / 2;
  return (
    <g>
      <rect
        x={ox}
        y={oy}
        width={s}
        height={s}
        rx={Math.min(3, s * 0.04)}
        className="fill-white stroke-slate-200"
        strokeWidth={0.8}
      />
      <circle
        cx={cx}
        cy={cy}
        r={s * 0.36}
        className="fill-none stroke-sky-300"
        strokeWidth={Math.max(0.6, s * 0.012)}
        strokeDasharray={`${s * 0.04} ${s * 0.04}`}
      />
      <path
        d={`M${cx} ${oy} V${oy + s} M${ox} ${cy} H${ox + s}`}
        className="fill-none stroke-sky-200"
        strokeWidth={Math.max(0.5, s * 0.01)}
      />
      <path
        d={`M${cx} ${cy - s * 0.24} L${cx + s * 0.24} ${cy + s * 0.18} H${cx - s * 0.24} Z`}
        className="fill-brand-500"
      />
      <circle cx={cx} cy={cy + s * 0.03} r={s * 0.085} className="fill-white help-art-as-drawn" />
    </g>
  );
}

/** A phone wireframe screen: a status notch, a heading, a picture box, list rows and a button. */
export function MiniWireframe({ x, y, w, h }: Box) {
  const pad = w * 0.12;
  const line = Math.max(1, h * 0.03);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={Math.min(5, w * 0.1)}
        className="fill-white stroke-slate-200"
        strokeWidth={0.8}
      />
      <rect
        x={x + w * 0.35}
        y={y + h * 0.03}
        width={w * 0.3}
        height={line}
        rx={line / 2}
        className="fill-slate-700"
      />
      <rect
        x={x + pad}
        y={y + h * 0.1}
        width={w * 0.5}
        height={line * 1.5}
        rx={line * 0.75}
        className="fill-brand-500"
      />
      <rect
        x={x + pad}
        y={y + h * 0.18}
        width={w - pad * 2}
        height={h * 0.26}
        rx={Math.min(2, w * 0.04)}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={0.6}
      />
      <path
        d={`M${x + pad} ${y + h * 0.18} L${x + w - pad} ${y + h * 0.44} M${x + w - pad} ${y + h * 0.18} L${x + pad} ${y + h * 0.44}`}
        className="stroke-brand-200"
        strokeWidth={0.6}
      />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={x + pad}
            y={y + h * (0.51 + i * 0.1)}
            width={h * 0.06}
            height={h * 0.06}
            rx={h * 0.015}
            className="fill-slate-200"
          />
          <rect
            x={x + pad + h * 0.09}
            y={y + h * (0.525 + i * 0.1)}
            width={(w - pad * 2 - h * 0.09) * (i === 2 ? 0.6 : 0.9)}
            height={line}
            rx={line / 2}
            className="fill-slate-200"
          />
        </g>
      ))}
      <rect
        x={x + pad}
        y={y + h * 0.84}
        width={w - pad * 2}
        height={h * 0.08}
        rx={h * 0.04}
        className="fill-brand-500"
      />
    </g>
  );
}

/** A website wireframe: a browser window with its bar, the page's navigation, a hero with its call to action and
 *  three cards. */
export function MiniWebsite({ x, y, w, h }: Box) {
  const barH = h * 0.12;
  const pad = w * 0.07;
  const line = Math.max(1, h * 0.032);
  const r = Math.min(3, w * 0.04);
  const heroY = y + barH + h * 0.12;
  const heroH = h * 0.34;
  const cardY = heroY + heroH + h * 0.06;
  const cardH = y + h - pad * 0.7 - cardY;
  const gap = w * 0.035;
  const cardW = (w - pad * 2 - gap * 2) / 3;
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <path
        d={`M${x} ${y + r}a${r} ${r} 0 0 1 ${r} ${-r}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + barH}H${x}Z`}
        className="fill-slate-100"
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={x + pad * 0.7 + i * barH * 0.55}
          cy={y + barH / 2}
          r={barH * 0.16}
          className="fill-slate-300"
        />
      ))}
      <Bar
        x={x + pad}
        y={y + barH + h * 0.04}
        w={w * 0.14}
        h={line * 1.4}
        className="fill-brand-500"
      />
      {[0, 1, 2].map((i) => (
        <Bar
          key={i}
          x={x + w * 0.56 + i * w * 0.12}
          y={y + barH + h * 0.045}
          w={w * 0.08}
          h={line}
          className="fill-slate-300"
        />
      ))}
      <rect
        x={x + pad}
        y={heroY}
        width={w - pad * 2}
        height={heroH}
        rx={Math.min(2, w * 0.02)}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={0.6}
      />
      <Bar
        x={x + pad * 1.6}
        y={heroY + heroH * 0.22}
        w={w * 0.4}
        h={line * 1.8}
        className="fill-slate-700"
      />
      <Bar
        x={x + pad * 1.6}
        y={heroY + heroH * 0.22 + line * 3.2}
        w={w * 0.3}
        h={line}
        className="fill-slate-300"
      />
      <rect
        x={x + pad * 1.6}
        y={heroY + heroH * 0.62}
        width={w * 0.18}
        height={heroH * 0.2}
        rx={heroH * 0.1}
        className="fill-brand-500"
      />
      {[0, 1, 2].map((i) => {
        const cx = x + pad + i * (cardW + gap);
        return (
          <g key={i}>
            <rect
              x={cx}
              y={cardY}
              width={cardW}
              height={cardH}
              rx={Math.min(2, cardW * 0.06)}
              className="fill-white stroke-slate-200"
              strokeWidth={0.6}
            />
            <rect
              x={cx + cardW * 0.12}
              y={cardY + cardH * 0.16}
              width={cardH * 0.3}
              height={cardH * 0.3}
              rx={cardH * 0.06}
              className="fill-brand-200"
            />
            <Bar x={cx + cardW * 0.12} y={cardY + cardH * 0.62} w={cardW * 0.7} h={line} />
          </g>
        );
      })}
    </g>
  );
}

/** A photo: a landscape picture (sky, sun and hills in the brand's tones) with an edit's adjustment slider under
 *  it. */
export function MiniPhoto({ x, y, w, h }: Box) {
  const pad = w * 0.06;
  const picH = h * 0.74;
  const px = x + pad;
  const py = y + pad * 0.8;
  const pw = w - pad * 2;
  const ph = picH - pad;
  const sliderY = y + picH + (h - picH) / 2;
  const line = Math.max(1, h * 0.03);
  return (
    <g>
      <Paper x={x} y={y} w={w} h={h} />
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        rx={Math.min(2, pw * 0.02)}
        className="fill-brand-100"
      />
      <circle cx={px + pw * 0.74} cy={py + ph * 0.3} r={ph * 0.13} className="fill-amber-300" />
      <path
        d={`M${px} ${py + ph} V${py + ph * 0.7} L${px + pw * 0.28} ${py + ph * 0.38} L${px + pw * 0.5} ${py + ph * 0.66} V${py + ph} Z`}
        className="fill-brand-300"
      />
      <path
        d={`M${px + pw * 0.3} ${py + ph} L${px + pw * 0.62} ${py + ph * 0.5} L${px + pw} ${py + ph * 0.84} V${py + ph} Z`}
        className="fill-brand-500"
      />
      <Bar x={px} y={sliderY - line / 2} w={pw} h={line} className="fill-slate-200" />
      <Bar x={px} y={sliderY - line / 2} w={pw * 0.58} h={line} className="fill-brand-400" />
      <circle
        cx={px + pw * 0.58}
        cy={sliderY}
        r={line * 2.2}
        className="fill-white stroke-brand-500"
        strokeWidth={Math.max(0.8, line * 0.7)}
      />
    </g>
  );
}
