// Explorer illustrations for the Library page (docs/specs/018-help/help-app.md): the Image gallery.
// Labels are lifted from the live editor's own copy (GalleryPane)
// so the figures match what a reader sees. Composed from the shared primitives.

import { Scene, Label } from './primitives';

// --- Local parts -------------------------------------------------------------

/** A picture motif (sun and hills) inside a box. */
function Picture({ x, y, w, h, hue }: { x: number; y: number; w: number; h: number; hue: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} className="fill-slate-50 stroke-slate-200" />
      <circle cx={x + w * 0.28} cy={y + h * 0.32} r={Math.min(w, h) * 0.1} className={hue} />
      <path
        d={`M${x + 6} ${y + h - 6} L${x + w * 0.38} ${y + h * 0.48} L${x + w * 0.58} ${y + h * 0.7} L${x + w * 0.74} ${y + h * 0.42} L${x + w - 6} ${y + h - 6} Z`}
        className={hue}
      />
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The Image gallery: the upload drop zone, then cards with the image, its name and size, a trash
 *  button, and a Used in N designs or Not used badge. */
export function GalleryCards() {
  const cards = [
    {
      name: 'logo.png',
      size: '640 × 320 · 48 KB',
      used: 'Used in 2 designs',
      hue: 'fill-brand-200',
    },
    {
      name: 'team-photo.jpg',
      size: '1600 × 900 · 1.1 MB',
      used: 'Used in 1 design',
      hue: 'fill-emerald-200',
    },
    { name: 'old-sketch.png', size: '800 × 600 · 210 KB', used: 'Not used', hue: 'fill-amber-200' },
  ];
  return (
    <Scene w={420} h={232} bg="plain">
      <rect
        x={20}
        y={14}
        width={380}
        height={40}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Label x={210} y={35} anchor="middle" size={11} tone="muted">
        Drop, paste, or click to upload an image
      </Label>
      {cards.map((c, i) => {
        const cx = 20 + i * 128;
        const cw = 124;
        const unused = c.used === 'Not used';
        return (
          <g key={c.name}>
            <rect
              x={cx}
              y={66}
              width={cw}
              height={152}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <Picture x={cx + 8} y={74} w={cw - 16} h={70} hue={c.hue} />
            <Label x={cx + 8} y={156} size={10} weight={600} tone="strong">
              {c.name}
            </Label>
            <Label x={cx + 8} y={170} size={10} tone="muted">
              {c.size}
            </Label>
            {/* Trash button */}
            <g transform={`translate(${cx + cw - 20} ${150})`}>
              <path
                d="M1 3 h10 M3 3 v8 h6 v-8 M4.5 1 h3"
                fill="none"
                className="stroke-rose-500"
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            </g>
            <rect
              x={cx + 7}
              y={182}
              width={unused ? 56 : cw - 14}
              height={18}
              rx={9}
              className={unused ? 'fill-slate-100' : 'fill-brand-50'}
            />
            <Label
              x={cx + 15}
              y={192}
              size={10}
              weight={600}
              className={unused ? 'fill-slate-500' : 'fill-brand-600'}
            >
              {c.used}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
