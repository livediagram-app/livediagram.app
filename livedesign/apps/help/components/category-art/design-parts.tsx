// livedesign's pages in miniature, for the scenes that draw a product's work into a box (a device's screen, a
// synced thumbnail, what the API made, the editor's canvas): a logo artboard with its construction guides and mark,
// and a phone wireframe screen. Each scales to the box it is handed.

type Box = { x: number; y: number; w: number; h: number };

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
