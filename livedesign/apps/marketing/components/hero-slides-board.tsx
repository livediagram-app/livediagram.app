import { FONT, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The hero's Slide Decks window (docs/specs/019-marketing/marketing-site.md "Hero"): a 16:9 slide page in Pages
// (docs/specs/007-editor/pages-mode.md) builds up, its title typed and three big numbers landing, the deck's
// pages filling the strip under it; then you press Present and the slide takes the screen, its page count and Notes
// at its foot. Every piece plays at its own --d (hero-scenes/pages.css); a phone draws the same deck smaller.

// The script, in seconds.
const T = {
  slide: 0.2,
  title: 0.6,
  stats: [1.6, 1.9, 2.2],
  strip: 2.8, // first page; the rest follow 0.15s apart
  present: 4.2, // the Present button lands
  cursor: 5.0,
  press: 5.9,
  presenting: 6.3,
  foot: 6.9,
} as const;

const SLIDE = { w: 380, h: 214 } as const;
const STATS = [
  { value: '48k', label: 'Active teams', colour: '#0284c7' },
  { value: '+32%', label: 'Quarter on quarter', colour: '#7c3aed' },
  { value: '4.9', label: 'Average rating', colour: '#db2777' },
] as const;
const TITLE = 'Q3 in three numbers';

// The slide itself, in its own 380 by 214 units, for the canvas and the presenting view to place and scale.
function Slide({ id, build }: { id: string; build: boolean }) {
  const d = (t: number) => (build ? at(t) : undefined);
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#ede9fe" />
        </linearGradient>
      </defs>
      <rect width={SLIDE.w} height={SLIDE.h} rx="4" fill={`url(#${id})`} />
      <text
        className={build ? 'hm-type' : undefined}
        style={build ? at(T.title, { '--steps': TITLE.length }) : undefined}
        x="24"
        y="40"
        fontFamily={FONT}
        fontSize="20"
        fontWeight="800"
        fill="#0f172a"
      >
        {TITLE}
      </text>
      <rect
        className={build ? 'hm-fade' : undefined}
        style={d(T.title + 0.5)}
        x="24"
        y="52"
        width="150"
        height="4"
        rx="2"
        fill="#64748b"
        opacity="0.5"
      />
      {STATS.map((s, i) => (
        <g key={s.value} className={build ? 'hm-pop' : undefined} style={d(T.stats[i]!)}>
          <rect
            x={24 + i * 116}
            y="78"
            width="104"
            height="100"
            rx="8"
            fill="#ffffff"
            fillOpacity="0.85"
            stroke="#ffffff"
          />
          <text
            x={36 + i * 116}
            y="128"
            fontFamily={FONT}
            fontSize="30"
            fontWeight="800"
            fill={s.colour}
          >
            {s.value}
          </text>
          <text
            x={36 + i * 116}
            y="152"
            fontFamily={FONT}
            fontSize="9.5"
            fontWeight="600"
            fill="#475569"
          >
            {s.label}
          </text>
        </g>
      ))}
    </>
  );
}

// A small page in the strip under the slide, ringed while it is the one shown.
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
      <rect x={x + 6} y={y + 7} width={28 - i * 3} height="3" rx="1.5" fill="#94a3b8" />
      {[0, 1, 2].map((k) => (
        <rect
          key={k}
          x={x + 6 + k * 18}
          y={y + 16}
          width="14"
          height="13"
          rx="2"
          fill={i === 0 ? STATS[k]!.colour : '#cbd5e1'}
          opacity={i === 0 ? 0.35 : 0.7}
        />
      ))}
    </g>
  );
}

function Deck() {
  const sx = 110;
  const sy = -30;
  const strip = sy + SLIDE.h + 18;
  return (
    <>
      {/* The page on the canvas, its drop shadow under it. */}
      <g className="hm-fade" style={at(T.slide)}>
        <rect
          x={sx + 2}
          y={sy + 4}
          width={SLIDE.w}
          height={SLIDE.h}
          rx="4"
          fill="#0f172a"
          opacity="0.08"
        />
      </g>
      <g className="hm-fade" style={at(T.slide)} transform={`translate(${sx} ${sy})`}>
        <Slide id="hs-slide-bg" build />
      </g>
      <text
        className="hm-fade fill-slate-500 dark:fill-slate-400"
        style={at(T.slide + 0.2)}
        x={sx}
        y={sy - 8}
        fontFamily={FONT}
        fontSize="9"
        fontWeight="600"
      >
        Slide 1
      </text>
      {/* The deck's pages, the shown one ringed. */}
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

      {/* Presenting: the slide takes the screen, its count and Notes at its foot. */}
      <g className="hm-fade" style={at(T.presenting)}>
        <rect x="-120" y="-80" width="840" height="460" fill="#020617" />
        <g transform="translate(46 -36) scale(1.335)">
          <Slide id="hs-slide-bg-full" build={false} />
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

export function SlidesBoard({ portrait = false }: { portrait?: boolean }) {
  // A phone draws the same deck, smaller and centred in its taller canvas.
  return portrait ? (
    <g transform="translate(-75 60) scale(0.85)">
      <Deck />
    </g>
  ) : (
    <Deck />
  );
}
