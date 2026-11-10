// livedocuments' work in miniature: an article, a slide, an infographic and a poster. In work-art's house style and contract (work-art.tsx):
// each draws into the box it is handed, in SVG user units, static, with no colour of its own.

import { Bar, Paper, fitBox, type WorkBox } from './work-art-parts';

type Box = WorkBox;

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
