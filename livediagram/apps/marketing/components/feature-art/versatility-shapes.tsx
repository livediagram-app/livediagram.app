// The shape library card (the Shapes panel's tiles and the shapes they make), split from
// ./versatility, which re-exports it. Drawn from ./versatility-parts on the 300 by 96 card stage,
// moving with the fa-c-* loops (app/feature-art/versatility.css).

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import {
  HAIRLINE,
  PANEL,
  PANEL_TEXT,
  STAGE,
  TONE_SHAPE,
  TONE_TEXT,
  delay,
} from '@liveworkspace/marketing-site/components/feature-art/versatility-parts';

// The shape library: the Shapes panel on the left with its tiles, the brand highlight walking the
// tiles, and on the canvas the shapes they make landing one after another: a cloud, a phone frame,
// a star, a speech bubble, an actor and a browser frame.
export function ShapesArt() {
  const tiles = [
    'rect',
    'circle',
    'diamond',
    'cloud',
    'star',
    'bubble',
    'phone',
    'browser',
    'actor',
  ];
  return (
    <Frame canvas>
      <svg viewBox={STAGE} className="absolute inset-0 h-full w-full">
        <rect className={PANEL} x="10" y="6" width="72" height="84" rx="5" strokeWidth="1" />
        <text className={PANEL_TEXT} x="17" y="17" fontSize="6.5" fontWeight="700">
          Shapes
        </text>
        {tiles.map((t, i) => {
          const x = 16 + (i % 3) * 21;
          const y = 23 + Math.floor(i / 3) * 21;
          return (
            <g key={t}>
              <rect
                className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
                x={x}
                y={y}
                width="18"
                height="17"
                rx="3"
                strokeWidth="0.8"
              />
              <rect
                className="fa-hl fill-sky-500/10 stroke-sky-500 dark:stroke-sky-400"
                style={delay(i * 0.66)}
                x={x}
                y={y}
                width="18"
                height="17"
                rx="3"
                strokeWidth="1.2"
              />
              <TileGlyph kind={t} x={x + 9} y={y + 8.5} />
            </g>
          );
        })}

        {/* The canvas: what the tiles drop, landing one after another. */}
        <g className="fa-pop" style={delay(0)}>
          <path
            className={TONE_SHAPE.sky}
            transform="translate(104 10) scale(1.15)"
            d="M7 24 C1 24 0 15 7 14.5 C7 7 16 4 21 9.5 C24 3 34 4 35 12 C41 12 42 24 35 24 Z"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </g>
        <g className="fa-pop" style={delay(0.35)}>
          <rect
            className="fill-slate-800 stroke-slate-800 dark:fill-slate-950 dark:stroke-slate-500"
            x="176"
            y="8"
            width="24"
            height="44"
            rx="5"
            strokeWidth="1"
          />
          <rect
            className="fill-sky-100 dark:fill-sky-500/30"
            x="178.5"
            y="12"
            width="19"
            height="36"
            rx="2"
          />
          <rect className="fill-sky-400" x="181" y="16" width="14" height="3" rx="1.5" />
          <rect
            className="fill-white/80 dark:fill-sky-200/40"
            x="181"
            y="22"
            width="10"
            height="2"
            rx="1"
          />
          <rect
            className="fill-white/80 dark:fill-sky-200/40"
            x="181"
            y="26"
            width="12"
            height="2"
            rx="1"
          />
          <rect className="fill-sky-500" x="181" y="40" width="14" height="4" rx="2" />
          <rect
            className="fill-slate-800 dark:fill-slate-500"
            x="184.5"
            y="9.2"
            width="7"
            height="1.6"
            rx="0.8"
          />
        </g>
        <g className="fa-pop" style={delay(0.7)}>
          <path
            className={TONE_SHAPE.violet}
            d={starPath(254, 28, 15, 6.4)}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </g>
        <g className="fa-pop" style={delay(1.05)}>
          <path
            className={TONE_SHAPE.emerald}
            transform="translate(104 54)"
            d="M0 5 a5 5 0 0 1 5-5 h40 a5 5 0 0 1 5 5 v13 a5 5 0 0 1-5 5 h-30 l-7 7 v-7 h-3 a5 5 0 0 1-5-5 z"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <text
            className={TONE_TEXT.emerald}
            x="129"
            y="68.5"
            fontSize="7.5"
            fontWeight="700"
            textAnchor="middle"
          >
            Ship it!
          </text>
        </g>
        <g className="fa-pop" style={delay(1.4)}>
          <g
            className="stroke-amber-500 dark:stroke-amber-400"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle className="fill-amber-50 dark:fill-amber-500/15" cx="188" cy="62" r="5.5" />
            <path d="M188 67.5 V80 M179 71.5 H197 M188 80 L181 90 M188 80 L195 90" />
          </g>
        </g>
        <g className="fa-pop" style={delay(1.75)}>
          <rect
            className={TONE_SHAPE.slate}
            x="226"
            y="56"
            width="64"
            height="34"
            rx="3"
            strokeWidth="1.2"
          />
          <path className={HAIRLINE} d="M226 63 H290" strokeWidth="1" />
          <circle className="fill-rose-400" cx="230.5" cy="59.5" r="1.2" />
          <circle className="fill-amber-400" cx="234.5" cy="59.5" r="1.2" />
          <circle className="fill-emerald-400" cx="238.5" cy="59.5" r="1.2" />
          <rect className="fill-sky-400" x="231" y="67" width="28" height="3.2" rx="1.6" />
          <rect
            className="fill-slate-200 dark:fill-slate-700"
            x="231"
            y="73.5"
            width="52"
            height="2"
            rx="1"
          />
          <rect
            className="fill-slate-200 dark:fill-slate-700"
            x="231"
            y="77.5"
            width="42"
            height="2"
            rx="1"
          />
          <rect className="fill-sky-500" x="231" y="82" width="16" height="4.5" rx="2.25" />
        </g>
      </svg>
    </Frame>
  );
}

// A five-point star centred on (cx, cy).
function starPath(cx: number, cy: number, r: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

// The glyph on a Shapes panel tile, centred on (x, y), in the panel's ink.
function TileGlyph({ kind, x, y }: { kind: string; x: number; y: number }) {
  const s = 'stroke-slate-500 dark:stroke-slate-300';
  const g = (d: string) => (
    <path
      className={s}
      d={d}
      fill="none"
      strokeWidth="1"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
  return (
    <g transform={`translate(${x - 6} ${y - 6})`}>
      {kind === 'rect' &&
        g(
          'M1.5 2.5 h9 a1.5 1.5 0 0 1 1.5 1.5 v5 a1.5 1.5 0 0 1-1.5 1.5 h-9 a1.5 1.5 0 0 1-1.5-1.5 v-5 a1.5 1.5 0 0 1 1.5-1.5z',
        )}
      {kind === 'circle' && (
        <circle className={s} cx="6" cy="6" r="5" fill="none" strokeWidth="1" />
      )}
      {kind === 'diamond' && g('M6 1 L11 6 L6 11 L1 6 Z')}
      {kind === 'cloud' &&
        g('M3 9.5 C0.5 9.5 0.5 6 3 6 C3 3 7 2 8.5 4.5 C10 3 12 4 11.5 6.5 C13 7 12.5 9.5 11 9.5 Z')}
      {kind === 'star' && g(starPath(6, 6.4, 5.4, 2.3))}
      {kind === 'bubble' && g('M1 2.5 h10 v6 h-6 l-3 2.5 v-2.5 h-1 z')}
      {kind === 'phone' &&
        g(
          'M3.5 0.5 h5 a1 1 0 0 1 1 1 v9 a1 1 0 0 1-1 1 h-5 a1 1 0 0 1-1-1 v-9 a1 1 0 0 1 1-1z M5 9.5 h2',
        )}
      {kind === 'browser' && g('M0.5 2 h11 v8 h-11 z M0.5 4.5 h11')}
      {kind === 'actor' &&
        g(
          'M6 1 a1.8 1.8 0 1 1 0 3.6 a1.8 1.8 0 1 1 0-3.6 M6 4.6 v3.6 M3 6 h6 M6 8.2 l-2.5 3.3 M6 8.2 l2.5 3.3',
        )}
    </g>
  );
}
