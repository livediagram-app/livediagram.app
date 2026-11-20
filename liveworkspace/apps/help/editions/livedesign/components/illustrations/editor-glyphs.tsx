// The small line glyphs livedesign's editor chrome wears (lucide icons in apps/live: the palette strip's category
// icons, the corner controls, the bottom bar's quick controls), drawn centred on (0, 0) about 10 units across so
// the chrome kit (./editor-chrome) can place them. Hairline strokes, as the real icons are at this size.

export const INK = {
  className: 'stroke-slate-600',
  strokeWidth: 1,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const BRAND_INK = { ...INK, className: 'stroke-brand-600' } as const;

export type GlyphName =
  | 'shapes'
  | 'write'
  | 'concepts'
  | 'components'
  | 'icons'
  | 'media'
  | 'data'
  | 'library'
  | 'search'
  | 'select'
  | 'menu'
  | 'share'
  | 'signIn'
  | 'undo'
  | 'redo'
  | 'palette'
  | 'tools'
  | 'settings'
  | 'bell'
  | 'monitor'
  | 'lock'
  | 'cog'
  | 'grip'
  | 'trash'
  | 'dots';

/** One chrome glyph, centred at (x, y). `brand` draws it in the accent (Library, Search, the select mode). */
export function Glyph({
  name,
  x,
  y,
  brand = false,
  s = 1,
}: {
  name: GlyphName;
  x: number;
  y: number;
  brand?: boolean;
  s?: number;
}) {
  const p = brand ? BRAND_INK : INK;
  const fillCls = brand ? 'fill-brand-600' : 'fill-slate-600';
  let body;
  switch (name) {
    case 'shapes':
      body = (
        <>
          <path d="M-2 -5 L1 0 H-5 Z" {...p} />
          <circle cx={2.6} cy={-2.2} r={2.4} {...p} />
          <rect x={-5} y={1.5} width={4} height={4} rx={0.6} {...p} />
          <rect x={1} y={1.5} width={4} height={4} rx={0.6} {...p} />
        </>
      );
      break;
    case 'write':
      body = (
        <path
          d="M-4.5 4.5 L-4 1.8 L2.6 -4.8 a1.3 1.3 0 0 1 2 2 L-2 3.8 Z M1.3 -3.4 L3.3 -1.4"
          {...p}
        />
      );
      break;
    case 'concepts':
      body = <path d="M0 -5 L5 4.5 H-5 Z M-2.6 0 H2.6 M-3.9 2.3 H3.9" {...p} />;
      break;
    case 'components':
      body = (
        <>
          <rect x={-5} y={-4.5} width={10} height={4} rx={1} {...p} />
          <rect x={-5} y={1} width={10} height={4} rx={1} {...p} />
        </>
      );
      break;
    case 'icons':
      body = (
        <>
          <circle r={5} {...p} />
          <path d="M-2.4 1.2 a2.6 2.6 0 0 0 4.8 0" {...p} />
          <circle cx={-1.8} cy={-1.4} r={0.5} className={fillCls} />
          <circle cx={1.8} cy={-1.4} r={0.5} className={fillCls} />
        </>
      );
      break;
    case 'media':
      body = (
        <>
          <rect x={-5} y={-4} width={10} height={8} rx={1.2} {...p} />
          <circle cx={-2} cy={-1.4} r={0.9} {...p} />
          <path d="M-5 3 L-1 0 L5 4" {...p} />
        </>
      );
      break;
    case 'data':
      body = <path d="M-4.5 5 V-1 M-1.5 5 V-4.5 M1.5 5 V1 M4.5 5 V-2.5" {...p} />;
      break;
    case 'library':
      body = <path d="M-4.5 -4.5 V4.5 M-1.8 -4.5 V4.5 M0.9 -4.5 V4.5 M2.6 -4.2 L5 4.3" {...p} />;
      break;
    case 'search':
      body = (
        <>
          <circle cx={-0.8} cy={-0.8} r={3.8} {...p} />
          <path d="M2 2 L4.8 4.8" {...p} />
        </>
      );
      break;
    case 'select':
      body = (
        <>
          <rect x={-5} y={-5} width={9} height={9} rx={1} strokeDasharray="1.6 1.4" {...p} />
          <path
            d="M0 0 L1.4 5.2 L2.4 2.6 L5 1.6 Z"
            {...p}
            className={
              brand ? 'fill-brand-600 stroke-brand-600' : 'fill-slate-600 stroke-slate-600'
            }
          />
        </>
      );
      break;
    case 'menu':
      body = <path d="M-5 -3.5 H5 M-5 0 H5 M-5 3.5 H5" {...p} />;
      break;
    case 'share':
      body = (
        <>
          <circle cx={3} cy={-3.5} r={1.6} {...p} />
          <circle cx={-3} cy={0} r={1.6} {...p} />
          <circle cx={3} cy={3.5} r={1.6} {...p} />
          <path d="M-1.6 -0.8 L1.6 -2.7 M-1.6 0.8 L1.6 2.7" {...p} />
        </>
      );
      break;
    case 'signIn':
      body = (
        <path
          d="M1 -5 H4 a1 1 0 0 1 1 1 V4 a1 1 0 0 1 -1 1 H1 M-4.5 0 H2 M-0.5 -2.5 L2 0 L-0.5 2.5"
          {...p}
        />
      );
      break;
    case 'undo':
      body = <path d="M-4 -1 H2 a3 3 0 0 1 0 6 H-1 M-2 -3.5 L-4.5 -1 L-2 1.5" {...p} />;
      break;
    case 'redo':
      body = <path d="M4 -1 H-2 a3 3 0 0 0 0 6 H1 M2 -3.5 L4.5 -1 L2 1.5" {...p} />;
      break;
    case 'palette':
      body = (
        <>
          <path
            d="M0 -5 a5 5 0 0 0 0 10 a1.2 1.2 0 0 0 1 -2 a1.2 1.2 0 0 1 1 -2 H3.4 a1.8 1.8 0 0 0 1.6 -1.8 A5 5 0 0 0 0 -5 Z"
            {...p}
          />
          <circle cx={-2.5} cy={-0.5} r={0.6} className={fillCls} />
          <circle cx={-1} cy={-3} r={0.6} className={fillCls} />
          <circle cx={1.8} cy={-2.8} r={0.6} className={fillCls} />
        </>
      );
      break;
    case 'tools':
      body = <path d="M-5 -2 H5 V4 H-5 Z M-2 -2 V-4 H2 V-2 M-5 1 H5" {...p} />;
      break;
    case 'settings':
      body = (
        <path
          d="M-5 -3 H1 M3 -3 H5 M-5 0 H-3 M-1 0 H5 M-5 3 H0 M2 3 H5 M2 -4.5 V-1.5 M-2 -1.5 V1.5 M1 1.5 V4.5"
          {...p}
        />
      );
      break;
    case 'bell':
      body = (
        <path d="M-4 2.5 H4 L3 1 V-1 a3 3 0 0 0 -6 0 V1 Z M-1.2 4.4 a1.4 1.4 0 0 0 2.4 0" {...p} />
      );
      break;
    case 'monitor':
      body = (
        <>
          <rect x={-5} y={-4} width={10} height={7} rx={1} {...p} />
          <path d="M-2 5 H2" {...p} />
        </>
      );
      break;
    case 'lock':
      body = (
        <>
          <rect x={-4} y={-0.5} width={8} height={5.5} rx={1} {...p} />
          <path d="M-2.5 -0.5 V-2.5 a2.5 2.5 0 0 1 4.8 -1" {...p} />
        </>
      );
      break;
    case 'cog':
      body = (
        <>
          <circle r={1.8} {...p} />
          <path
            d="M0 -5 V-3.4 M0 5 V3.4 M-5 0 H-3.4 M5 0 H3.4 M-3.5 -3.5 L-2.4 -2.4 M3.5 3.5 L2.4 2.4 M3.5 -3.5 L2.4 -2.4 M-3.5 3.5 L-2.4 2.4"
            {...p}
          />
          <circle r={3.4} {...p} />
        </>
      );
      break;
    case 'grip':
      body = (
        <>
          {[-3, 0, 3].map((dy) => (
            <g key={dy}>
              <circle cx={-1.3} cy={dy} r={0.6} className="fill-slate-400" />
              <circle cx={1.3} cy={dy} r={0.6} className="fill-slate-400" />
            </g>
          ))}
        </>
      );
      break;
    case 'trash':
      body = (
        <path
          d="M-3.5 -2.5 H3.5 M-2.8 -2.5 L-2.3 4 H2.3 L2.8 -2.5 M-1.2 -2.5 V-4 H1.2 V-2.5"
          {...p}
          className="stroke-slate-400"
        />
      );
      break;
    case 'dots':
      body = (
        <>
          {[-3, 0, 3].map((dx) => (
            <circle
              key={dx}
              cx={dx}
              cy={0}
              r={0.75}
              className={brand ? 'fill-brand-500' : 'fill-slate-400'}
            />
          ))}
        </>
      );
      break;
  }
  return <g transform={`translate(${x} ${y})${s !== 1 ? ` scale(${s})` : ''}`}>{body}</g>;
}

/** livedesign's mark: the red isometric cube, its top lightest, centred at (x, y), about 12 units across. */
export function LogoCube({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -6 L6 -3 L0 0 L-6 -3 Z" className="fill-brand-400" />
      <path d="M-6 -3 L0 0 V6.5 L-6 3.5 Z" className="fill-brand-600" />
      <path d="M6 -3 L0 0 V6.5 L6 3.5 Z" className="fill-brand-500" />
    </g>
  );
}
