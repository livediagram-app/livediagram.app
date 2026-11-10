// livedesign's work in miniature: a logo, a phone and a website wireframe and a photo. In work-art's house style and contract (work-art.tsx):
// each draws into the box it is handed, in SVG user units, static, with no colour of its own.

import { Bar, Paper, type WorkBox } from './work-art-parts';

type Box = WorkBox;

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
