// Small pages on the canvas for the Collaborate and canvas cards: a logo artboard, a phone screen or a
// photo, the three page kinds a livedesign tab is made of (docs/specs/003-system-architecture/domain-language.md
// "Page kind"). The collaboration cards point, glow, comment and follow on these, so the scene reads as
// a design's pages rather than a diagram's boxes. Plain SVG in the cards' 300 by 96 viewBox: paper as
// page-kit draws it (white in light, a lifted slate sheet in dark), wireframe blocks in slate, and a
// photo in its own fixed colours, the same in both appearances, as a picture is.

import { SKY, VIOLET } from '@liveworkspace/marketing-site/components/feature-art/shared';

export type PageKind = 'logo' | 'phone' | 'photo';

export type PageSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PageKind;
  /** The page's name, drawn above it as the canvas labels a page. */
  label?: string;
  /** A phone screen's title, set in its heading (a block when left out). */
  title?: string;
};

const PAPER = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
const SHADE = 'fill-slate-900/10 dark:fill-black/40';
const BLOCK = 'fill-slate-200 dark:fill-slate-600';
const INK = 'fill-slate-800 dark:fill-slate-100';
const LABEL = 'fill-slate-500 dark:fill-slate-400';

/** A photo's sky, sun and hills filling a box. Fixed colours: it is a picture, not chrome. */
export function PhotoFill({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1" fill="#bae6fd" />
      <rect x={x} y={y} width={w} height={h * 0.45} rx="1" fill="#7dd3fc" fillOpacity="0.55" />
      <circle cx={x + w * 0.74} cy={y + h * 0.32} r={Math.min(w, h) * 0.12} fill="#fde047" />
      <path
        d={`M${x} ${y + h * 0.72} Q ${x + w * 0.28} ${y + h * 0.48} ${x + w * 0.55} ${y + h * 0.66} T ${x + w} ${y + h * 0.6} V ${y + h - 1} Q ${x + w} ${y + h} ${x + w - 1} ${y + h} H ${x + 1} Q ${x} ${y + h} ${x} ${y + h - 1} Z`}
        fill="#4ade80"
      />
      <path
        d={`M${x} ${y + h * 0.86} Q ${x + w * 0.5} ${y + h * 0.72} ${x + w} ${y + h * 0.84} V ${y + h - 1} Q ${x + w} ${y + h} ${x + w - 1} ${y + h} H ${x + 1} Q ${x} ${y + h} ${x} ${y + h - 1} Z`}
        fill="#15803d"
      />
    </g>
  );
}

/** One page on the canvas, drawn as its kind: a logo, a phone wireframe or a photo. */
export function MiniPage({ x, y, w, h, kind, label, title }: PageSpec) {
  const rx = kind === 'phone' ? Math.min(5, w * 0.16) : 1.6;
  return (
    <g>
      {label ? (
        <text className={LABEL} x={x} y={y - 2.6} fontSize="5" fontWeight="600" fill="#64748b">
          {label}
        </text>
      ) : null}
      <rect className={SHADE} x={x + 0.8} y={y + 1.6} width={w} height={h} rx={rx} />
      {kind === 'photo' ? (
        <PhotoFill x={x} y={y} w={w} h={h} />
      ) : (
        <rect className={PAPER} x={x} y={y} width={w} height={h} rx={rx} strokeWidth="0.8" />
      )}
      {kind === 'logo' ? <LogoMark x={x} y={y} w={w} h={h} /> : null}
      {kind === 'phone' ? <PhoneScreen x={x} y={y} w={w} h={h} title={title} /> : null}
    </g>
  );
}

/** The Bloom mark and its wordmark, centred on a square artboard. */
function LogoMark({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const s = Math.min(w, h);
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  return (
    <g>
      <circle cx={cx} cy={cy} r={s * 0.19} fill="none" stroke={SKY} strokeWidth={s * 0.075} />
      <circle cx={cx} cy={cy} r={s * 0.075} fill={VIOLET} />
      <text
        className={INK}
        x={cx}
        y={y + h * 0.84}
        fontSize={s * 0.15}
        fontWeight="800"
        textAnchor="middle"
        fill="#1e293b"
      >
        Bloom
      </text>
    </g>
  );
}

/** A phone wireframe: the notch, a heading, a picture, two lines and the button. */
function PhoneScreen({
  x,
  y,
  w,
  h,
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
}) {
  const pad = w * 0.14;
  const inner = w - pad * 2;
  return (
    <g>
      <rect
        className="fill-slate-700 dark:fill-slate-300"
        x={x + w * 0.36}
        y={y + 2.4}
        width={w * 0.28}
        height="1.6"
        rx="0.8"
      />
      {title ? (
        <text
          className={INK}
          x={x + pad}
          y={y + 11.5}
          fontSize="4.6"
          fontWeight="800"
          fill="#1e293b"
        >
          {title}
        </text>
      ) : (
        <rect className={BLOCK} x={x + pad} y={y + 8} width={inner * 0.6} height="3" rx="1" />
      )}
      <rect className={BLOCK} x={x + pad} y={y + 15} width={inner} height={h * 0.26} rx="1.4" />
      <rect
        className={BLOCK}
        x={x + pad}
        y={y + 17 + h * 0.26}
        width={inner}
        height="1.6"
        rx="0.8"
      />
      <rect
        className={BLOCK}
        x={x + pad}
        y={y + 20.5 + h * 0.26}
        width={inner * 0.7}
        height="1.6"
        rx="0.8"
      />
      <rect x={x + pad} y={y + h - 9} width={inner} height="4.6" rx="2.3" fill={SKY} />
    </g>
  );
}
