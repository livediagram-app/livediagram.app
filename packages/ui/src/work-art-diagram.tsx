// livediagram's work in miniature: a flowchart, a mind map, a whiteboard and a workshop. In work-art's house style and contract (work-art.tsx):
// each draws into the box it is handed, in SVG user units, static, with no colour of its own.

import { Bar, Paper, type WorkBox } from './work-art-parts';

type Box = WorkBox;

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
