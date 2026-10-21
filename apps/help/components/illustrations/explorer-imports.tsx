// Explorer illustrations for the Library pages (docs/specs/018-help/help-app.md): the Image
// gallery and the Themes page. Labels are lifted from the live editor's own copy (GalleryPane,
// ThemesPane) so the figures match what a reader sees. Composed from the shared primitives.

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
 *  button, and a Used in N documents or Not used badge. */
export function GalleryCards() {
  const cards = [
    {
      name: 'logo.png',
      size: '640 × 320 · 48 KB',
      used: 'Used in 2 documents',
      hue: 'fill-brand-200',
    },
    {
      name: 'team-photo.jpg',
      size: '1600 × 900 · 1.1 MB',
      used: 'Used in 1 document',
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

/** The Themes page: a card per saved theme (swatch, name, Edit, Duplicate and Delete buttons) and
 *  the dashed New Theme card. */
export function SavedThemeCards() {
  const themes = [
    { name: 'Ocean', swatches: ['fill-brand-500', 'fill-brand-300', 'fill-brand-100'] },
    { name: 'Forest', swatches: ['fill-emerald-500', 'fill-emerald-400', 'fill-teal-400'] },
    { name: 'Sunset', swatches: ['fill-rose-500', 'fill-amber-500', 'fill-amber-400'] },
  ];
  return (
    <Scene w={420} h={176} bg="plain">
      <Label x={24} y={22} size={14} weight={700} tone="strong">
        Themes
      </Label>
      {themes.map((t, i) => {
        const tx = 20 + i * 96;
        return (
          <g key={t.name}>
            <rect
              x={tx}
              y={38}
              width={88}
              height={122}
              rx={10}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <g className="help-art-as-drawn">
              {t.swatches.map((s, j) => (
                <rect
                  key={j}
                  x={tx + 10 + j * 23}
                  y={48}
                  width={22}
                  height={40}
                  rx={j === 0 ? 4 : 0}
                  className={s}
                />
              ))}
            </g>
            <Label x={tx + 10} y={104} size={11} weight={600} tone="strong">
              {t.name}
            </Label>
            {/* Edit, Duplicate, Delete */}
            {[0, 1, 2].map((j) => (
              <g key={j}>
                <rect
                  x={tx + 10 + j * 24}
                  y={120}
                  width={20}
                  height={20}
                  rx={5}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1.2}
                />
                {j === 0 && (
                  <path
                    d={`M${tx + 15} ${135} l1 -3.5 l6 -6 l2.5 2.5 l-6 6 Z`}
                    fill="none"
                    className="stroke-slate-500"
                    strokeWidth={1.1}
                  />
                )}
                {j === 1 && (
                  <g fill="none" className="stroke-slate-500" strokeWidth={1.1}>
                    <rect x={tx + 39} y={126} width={7} height={8} rx={1} />
                    <path d={`M${tx + 42} ${126} v-2 h7 v8 h-3`} />
                  </g>
                )}
                {j === 2 && (
                  <path
                    d={`M${tx + 63} ${126} h10 M${tx + 65} ${126} v8 h6 v-8 M${tx + 66.5} ${124} h3`}
                    fill="none"
                    className="stroke-rose-500"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                  />
                )}
              </g>
            ))}
          </g>
        );
      })}
      <rect
        x={308}
        y={38}
        width={92}
        height={122}
        rx={10}
        className="fill-none stroke-slate-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <path
        d="M354 86 v14 M347 93 h14"
        className="stroke-slate-400"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Label x={354} y={114} anchor="middle" size={10} weight={500} tone="muted">
        New Theme
      </Label>
    </Scene>
  );
}
