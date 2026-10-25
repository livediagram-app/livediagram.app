// livedocuments's pages in miniature, for the scenes that draw a product's work into a box (a device's screen, a
// synced thumbnail, what the API made, a tab): an article page of flowing text, and a slide with its title and a
// chart. Each scales to the box it is handed, so it reads the same on a laptop and in a thumbnail.

type Box = { x: number; y: number; w: number; h: number };

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
