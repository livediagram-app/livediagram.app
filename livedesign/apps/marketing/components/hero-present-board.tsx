import { FONT, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The hero's Present window (docs/specs/019-marketing/marketing-site.md "Hero"): a website wireframe page in
// Pages (docs/specs/007-editor/wireframe-pages.md) builds up in its browser frame, its headline typed and its
// parts landing, the design's other pages (the logo and the app screens) filling the strip under it; then you
// press Present and the page takes the screen, its page count and Notes at its foot. Every piece plays at its
// own --d (hero-scenes/pages.css); a phone draws the same design smaller.

// The script, in seconds.
const T = {
  page: 0.2,
  title: 0.6,
  parts: [1.6, 1.9, 2.2],
  strip: 2.8, // first page; the rest follow 0.15s apart
  present: 4.2, // the Present button lands
  cursor: 5.0,
  press: 5.9,
  presenting: 6.3,
  foot: 6.9,
} as const;

const PAGE = { w: 380, h: 214 } as const;
const TITLE = 'Fresh bread, daily';
const SKY = '#0284c7';
const WIRE = '#cbd5e1';
const WIRE_SOFT = '#e2e8f0';

// The website wireframe in its browser frame, in its own 380 by 214 units, for the canvas and the presenting
// view to place and scale.
function Wireframe({ build }: { build: boolean }) {
  const d = (t: number) => (build ? at(t) : undefined);
  const cls = (name: string) => (build ? name : undefined);
  return (
    <>
      <rect width={PAGE.w} height={PAGE.h} rx="4" fill="#ffffff" stroke={WIRE_SOFT} />
      {/* The browser's bar: its three dots and the address. */}
      <rect width={PAGE.w} height="20" rx="4" fill="#f1f5f9" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={12 + i * 9} cy="10" r="2.6" fill={WIRE} />
      ))}
      <rect x="110" y="5" width="160" height="10" rx="5" fill="#ffffff" />
      {/* The nav: the mark and three links. */}
      <circle cx="30" cy="38" r="7" fill={SKY} fillOpacity="0.85" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={260 + i * 36} y="35" width="26" height="5" rx="2.5" fill={WIRE} />
      ))}
      <text
        className={cls('hm-type')}
        style={build ? at(T.title, { '--steps': TITLE.length }) : undefined}
        x="24"
        y="88"
        fontFamily={FONT}
        fontSize="19"
        fontWeight="800"
        fill="#0f172a"
      >
        {TITLE}
      </text>
      <g className={cls('hm-fade')} style={d(T.parts[0])}>
        <rect x="24" y="100" width="150" height="5" rx="2.5" fill={WIRE} />
        <rect x="24" y="111" width="110" height="5" rx="2.5" fill={WIRE} />
      </g>
      <g className={cls('hm-pop')} style={d(T.parts[1])}>
        <rect x="24" y="130" width="76" height="22" rx="11" fill={SKY} />
        <text
          x="62"
          y="144.5"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="9"
          fontWeight="700"
          fill="#ffffff"
        >
          Order now
        </text>
      </g>
      {/* The picture's placeholder, crossed as a wireframe draws one. */}
      <g className={cls('hm-pop')} style={d(T.parts[2])}>
        <rect x="216" y="56" width="140" height="134" rx="6" fill="#f8fafc" stroke={WIRE} />
        <path d="M216 56L356 190M356 56L216 190" stroke={WIRE} strokeWidth="1.2" />
      </g>
    </>
  );
}

// A small page in the strip under the page, ringed while it is the one shown: this website page, the logo, then
// two phone screens.
function Thumb({ x, y, i, active }: { x: number; y: number; i: number; active: boolean }) {
  return (
    <g className="hm-pop" style={at(T.strip + i * 0.15)}>
      <rect
        x={x}
        y={y}
        width="64"
        height="36"
        rx="3"
        className="fill-white dark:fill-slate-800"
        stroke={active ? '#0ea5e9' : undefined}
        strokeWidth={active ? 2 : 0}
      />
      {i === 0 ? (
        <>
          <rect x={x + 6} y={y + 8} width="26" height="3" rx="1.5" fill="#94a3b8" />
          <rect x={x + 6} y={y + 15} width="18" height="2" rx="1" fill={WIRE} />
          <rect x={x + 38} y={y + 7} width="20" height="22" rx="2" fill={WIRE} />
        </>
      ) : i === 1 ? (
        <>
          <circle cx={x + 32} cy={y + 15} r="8" fill={SKY} fillOpacity="0.85" />
          <rect x={x + 20} y={y + 27} width="24" height="3" rx="1.5" fill="#94a3b8" />
        </>
      ) : (
        <>
          <rect x={x + 24} y={y + 4} width="16" height="28" rx="3" fill="none" stroke="#94a3b8" />
          <rect x={x + 27} y={y + 10} width="10" height="2" rx="1" fill={WIRE} />
          <rect x={x + 27} y={y + 22} width="10" height="4" rx="2" fill={SKY} fillOpacity="0.6" />
        </>
      )}
    </g>
  );
}

function Design() {
  const sx = 110;
  const sy = -30;
  const strip = sy + PAGE.h + 18;
  return (
    <>
      {/* The page on the canvas, its drop shadow under it. */}
      <g className="hm-fade" style={at(T.page)}>
        <rect
          x={sx + 2}
          y={sy + 4}
          width={PAGE.w}
          height={PAGE.h}
          rx="4"
          fill="#0f172a"
          opacity="0.08"
        />
      </g>
      <g className="hm-fade" style={at(T.page)} transform={`translate(${sx} ${sy})`}>
        <Wireframe build />
      </g>
      <text
        className="hm-fade fill-slate-500 dark:fill-slate-400"
        style={at(T.page + 0.2)}
        x={sx}
        y={sy - 8}
        fontFamily={FONT}
        fontSize="9"
        fontWeight="600"
      >
        Home page · Browser
      </text>
      {/* The design's pages, the shown one ringed. */}
      {[0, 1, 2, 3].map((i) => (
        <Thumb key={i} x={sx + 34 + i * 80} y={strip} i={i} active={i === 0} />
      ))}

      {/* Present, at the canvas's top right; you press it. */}
      <g className="hm-pop" style={at(T.present)}>
        <rect x="498" y="-52" width="80" height="22" rx="11" fill="#0284c7" />
        <path d="M512 -46.5L519 -41L512 -35.5Z" fill="#ffffff" />
        <text x="524" y="-37" fontFamily={FONT} fontSize="9.5" fontWeight="700" fill="#ffffff">
          Present
        </text>
      </g>
      <g className="hm-pop" style={at(T.press)}>
        <rect
          x="495"
          y="-55"
          width="86"
          height="28"
          rx="14"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          className="hm-out"
          style={at(T.press + 0.35)}
        />
      </g>
      <g
        className="hm-cursor"
        style={at(T.cursor, { '--sx': '420px', '--sy': '120px', '--cx': '538px', '--cy': '-38px' })}
        aria-hidden
      >
        <CursorMark colour={YOU} label="You" badge="name" />
      </g>

      {/* Presenting: the page takes the screen, its count and Notes at its foot. */}
      <g className="hm-fade" style={at(T.presenting)}>
        <rect x="-120" y="-80" width="840" height="460" fill="#020617" />
        <g transform="translate(46 -36) scale(1.335)">
          <Wireframe build={false} />
        </g>
      </g>
      <g className="hm-fade" style={at(T.foot)}>
        <rect x="246" y="262" width="108" height="24" rx="12" fill="#1e293b" />
        <text
          x="300"
          y="278"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="10"
          fontWeight="700"
          fill="#e2e8f0"
        >
          ‹ 1 / 4 ›
        </text>
        <rect x="496" y="262" width="60" height="24" rx="12" fill="#1e293b" />
        <text x="510" y="278" fontFamily={FONT} fontSize="10" fontWeight="600" fill="#e2e8f0">
          Notes
        </text>
      </g>
    </>
  );
}

export function PresentBoard({ portrait = false }: { portrait?: boolean }) {
  // A phone draws the same design, smaller and centred in its taller canvas.
  return portrait ? (
    <g transform="translate(-75 60) scale(0.85)">
      <Design />
    </g>
  ) : (
    <Design />
  );
}
