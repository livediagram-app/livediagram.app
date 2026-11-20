// The small line glyphs liveplanner's editor chrome wears (lucide icons in liveplanner/apps/editor: the board
// header, the corner controls, the bottom bar's tab icons and quick controls), drawn centred on (0, 0) about 10
// units across so the chrome kit (./planner-chrome) can place them. Hairline strokes, as the real icons are at
// this size.

export const INK = {
  className: 'stroke-slate-600',
  strokeWidth: 1,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const BRAND_INK = { ...INK, className: 'stroke-brand-600' } as const;

export type GlyphName =
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
  | 'sun'
  | 'moon'
  | 'lock'
  | 'trash'
  | 'cardTypes'
  | 'dots'
  | 'search'
  | 'plus'
  | 'pencil'
  | 'collapse'
  | 'calendar'
  | 'clock'
  | 'timer'
  | 'vote'
  | 'play'
  | 'board'
  | 'sheet'
  | 'dashboard'
  | 'form'
  | 'task'
  | 'action'
  | 'story'
  | 'initiative'
  | 'bug'
  | 'eyeOff'
  | 'chevron';

/** One chrome glyph, centred at (x, y). `brand` draws it in the accent. */
export function Glyph({
  name,
  x,
  y,
  brand = false,
  s = 1,
  className,
}: {
  name: GlyphName;
  x: number;
  y: number;
  brand?: boolean;
  s?: number;
  /** A stroke class in place of the slate or brand ink (a card type's hue). */
  className?: string;
}) {
  const p = className ? { ...INK, className } : brand ? BRAND_INK : INK;
  let body;
  switch (name) {
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
          <circle cx={-2.5} cy={-0.5} r={0.6} {...p} />
          <circle cx={-1} cy={-3} r={0.6} {...p} />
          <circle cx={1.8} cy={-2.8} r={0.6} {...p} />
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
    case 'sun':
      body = (
        <>
          <circle r={2.2} {...p} />
          <path
            d="M0 -5 V-3.8 M0 5 V3.8 M-5 0 H-3.8 M5 0 H3.8 M-3.5 -3.5 L-2.7 -2.7 M3.5 3.5 L2.7 2.7 M3.5 -3.5 L2.7 -2.7 M-3.5 3.5 L-2.7 2.7"
            {...p}
          />
        </>
      );
      break;
    case 'moon':
      body = <path d="M3.5 1.5 A4.5 4.5 0 1 1 -1.5 -4.5 A3.5 3.5 0 0 0 3.5 1.5 Z" {...p} />;
      break;
    case 'lock':
      body = (
        <>
          <rect x={-4} y={-0.5} width={8} height={5.5} rx={1} {...p} />
          <path d="M-2.5 -0.5 V-2.5 a2.5 2.5 0 0 1 5 0 V-0.5" {...p} />
        </>
      );
      break;
    case 'trash':
      body = (
        <path
          d="M-4 -2.5 H4 M-3 -2.5 L-2.5 4.5 H2.5 L3 -2.5 M-1.3 -2.5 V-4.2 H1.3 V-2.5 M-0.9 0 V2.5 M0.9 0 V2.5"
          {...p}
        />
      );
      break;
    case 'cardTypes':
      body = (
        <>
          <rect x={-3.5} y={-2} width={8} height={6.5} rx={1} {...p} />
          <path d="M-5 2.5 V-3 a1 1 0 0 1 1 -1 H3" {...p} />
          <path d="M-1.5 0.5 H2.5 M-1.5 2.3 H1" {...p} />
        </>
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
    case 'search':
      body = (
        <>
          <circle cx={-0.8} cy={-0.8} r={3.6} {...p} />
          <path d="M1.9 1.9 L4.5 4.5" {...p} />
        </>
      );
      break;
    case 'plus':
      body = <path d="M-4 0 H4 M0 -4 V4" {...p} />;
      break;
    case 'pencil':
      body = (
        <path
          d="M-4 4 L-3.6 1.6 L2.4 -4.4 a1.2 1.2 0 0 1 1.8 1.8 L-1.8 3.6 Z M1.2 -3.2 L3 -1.4"
          {...p}
        />
      );
      break;
    case 'collapse':
      body = (
        <path
          d="M0 -4.5 V4.5 M-5 0 H-2 M-3.3 -1.5 L-2 0 L-3.3 1.5 M5 0 H2 M3.3 -1.5 L2 0 L3.3 1.5"
          {...p}
        />
      );
      break;
    case 'calendar':
      body = (
        <>
          <rect x={-4.5} y={-3.5} width={9} height={8} rx={1.2} {...p} />
          <path d="M-4.5 -0.5 H4.5 M-2 -5 V-2.5 M2 -5 V-2.5" {...p} />
        </>
      );
      break;
    case 'clock':
      body = (
        <>
          <circle r={4.5} {...p} />
          <path d="M0 -2.5 V0 L1.8 1.2" {...p} />
        </>
      );
      break;
    case 'timer':
      body = (
        <>
          <circle cy={0.8} r={4} {...p} />
          <path d="M-1.5 -4.8 H1.5 M0 0.8 V-1.4" {...p} />
        </>
      );
      break;
    case 'vote':
      body = (
        <>
          <circle r={4.5} {...p} />
          <path d="M-2 0 L-0.5 1.6 L2.2 -1.4" {...p} />
        </>
      );
      break;
    case 'play':
      body = <path d="M-2 -3 L3 0 L-2 3 Z" {...p} />;
      break;
    case 'board':
      body = (
        <>
          <rect x={-4.5} y={-4.5} width={9} height={9} rx={1.5} {...p} />
          <path d="M-2 -2 V1.5 M0.5 -2 V-0.2 M3 -2 V0.8" {...p} />
        </>
      );
      break;
    case 'sheet':
      body = (
        <>
          <rect x={-4.5} y={-4.5} width={9} height={9} rx={1.2} {...p} />
          <path d="M-4.5 -1.5 H4.5 M-4.5 1.5 H4.5 M-1.5 -4.5 V4.5 M1.5 -4.5 V4.5" {...p} />
        </>
      );
      break;
    case 'dashboard':
      body = (
        <>
          <rect x={-4.5} y={-4.5} width={4} height={4} rx={0.8} {...p} />
          <rect x={0.5} y={-4.5} width={4} height={4} rx={0.8} {...p} />
          <rect x={-4.5} y={0.5} width={4} height={4} rx={0.8} {...p} />
          <rect x={0.5} y={0.5} width={4} height={4} rx={0.8} {...p} />
        </>
      );
      break;
    case 'form':
      body = (
        <>
          <rect x={-3.8} y={-4} width={7.6} height={9} rx={1} {...p} />
          <path d="M-1.5 -4.8 H1.5 M-1.8 -0.5 H1.8 M-1.8 2 H1.8" {...p} />
        </>
      );
      break;
    // The card types' own icons (in their chips and the header's type buttons).
    case 'task':
      body = (
        <>
          <circle r={3.8} {...p} />
          <path d="M-1.6 0 L-0.4 1.3 L1.8 -1.2" {...p} />
        </>
      );
      break;
    case 'action':
      body = (
        <>
          <circle r={4} {...p} />
          <circle r={1.8} {...p} />
        </>
      );
      break;
    case 'story':
      body = <path d="M-3.5 -4 H3.5 V4 L0 2 L-3.5 4 Z" {...p} />;
      break;
    case 'initiative':
      body = <path d="M-4.5 3.5 L-1.5 -2.5 L1 1.5 L2.5 -0.5 L4.5 3.5 Z" {...p} />;
      break;
    case 'bug':
      body = (
        <>
          <rect x={-2.5} y={-2.5} width={5} height={6.5} rx={2.5} {...p} />
          <path
            d="M-2.5 0 H-4.5 M2.5 0 H4.5 M-2.5 2.5 L-4 4 M2.5 2.5 L4 4 M-1.5 -2.5 L-3 -4 M1.5 -2.5 L3 -4"
            {...p}
          />
        </>
      );
      break;
    case 'eyeOff':
      body = <path d="M-4.5 0 Q0 -5 4.5 0 Q0 5 -4.5 0 Z M-4 -4 L4 4" {...p} />;
      break;
    case 'chevron':
      body = <path d="M-2.5 -1.2 L0 1.3 L2.5 -1.2" {...p} />;
      break;
  }
  return <g transform={`translate(${x} ${y})${s !== 1 ? ` scale(${s})` : ''}`}>{body}</g>;
}

/** liveplanner's mark: the violet isometric cube, its top lightest, centred at (x, y), about 12 units across. */
export function LogoCube({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -6 L6 -3 L0 0 L-6 -3 Z" className="fill-brand-400" />
      <path d="M-6 -3 L0 0 V6.5 L-6 3.5 Z" className="fill-brand-600" />
      <path d="M6 -3 L0 0 V6.5 L6 3.5 Z" className="fill-brand-500" />
    </g>
  );
}
