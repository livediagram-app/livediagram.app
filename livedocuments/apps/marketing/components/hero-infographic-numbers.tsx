import type { StyledPrim } from '@livedocuments/icons';
import { lucideHeart, lucideLayers, lucideStar, lucideUsers } from '@livedocuments/icons/lucide';
import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';
import {
  CONTENT,
  HAIRLINE,
  INK,
  InfoFooter,
  InfoHeading,
  InfoIcon,
  InfoSheet,
  MARGIN,
  MUTED,
  TEAL,
  TEAL_DEEP,
} from './hero-infographic-parts';

// Page 2 of the hero's Infographic window, the template's numbers page: four tinted stat tiles,
// each with its glyph on a disc, land in turn; then the chart card, whose bars grow from the axis
// and whose ring fills to its share. A teammate's cursor comes in and selects the card, outline,
// handles and all, as Pages selects an element.

type Stat = {
  value: string;
  label: string;
  tint: string;
  ink: string;
  disc: string;
  icon: readonly StyledPrim[];
};

const STATS: Stat[] = [
  {
    value: '42',
    label: 'projects shipped',
    tint: '#d1fae5',
    ink: '#047857',
    disc: '#10b981',
    icon: lucideLayers,
  },
  {
    value: '18',
    label: 'clients, seven new',
    tint: '#e0f2fe',
    ink: '#0369a1',
    disc: '#0ea5e9',
    icon: lucideUsers,
  },
  {
    value: '1',
    label: 'app of our own',
    tint: '#ede9fe',
    ink: '#6d28d9',
    disc: '#8b5cf6',
    icon: lucideStar,
  },
  {
    value: '97%',
    label: 'would hire us again',
    tint: '#ffe4e6',
    ink: '#be123c',
    disc: '#f43f5e',
    icon: lucideHeart,
  },
];

// Projects shipped each quarter, the last called out.
const BARS = [
  { q: 'Q1', v: 7 },
  { q: 'Q2', v: 10 },
  { q: 'Q3', v: 9 },
  { q: 'Q4', v: 16 },
];
const BAR_MAX = 16;
const BAR_SPAN = 48;

const RING_R = 17;
const RING_LEN = 2 * Math.PI * RING_R;
const RING_SHARE = 0.92;

// When the page starts building: the cover goes first.
const T = 2.4;

export function NumbersPage({ x, y, of }: { x: number; y: number; of: number }) {
  const left = x + MARGIN;
  const tileW = (CONTENT - 8) / 2;
  const tileH = 44;
  const card = { x: left, y: y + 160, w: CONTENT, h: 104 };
  const base = card.y + 82;
  const ring = { cx: card.x + 146, cy: card.y + 52 };
  return (
    <InfoSheet x={x} y={y} name="Numbers" n={2} of={of}>
      <g className="hm-pop" style={at(T)}>
        <InfoHeading
          x={left}
          y={y + 22}
          kicker="THE YEAR IN NUMBERS"
          title="What we did in 2026"
          colour={TEAL}
        />
      </g>

      {/* The four stats, two by two. */}
      {STATS.map((s, i) => {
        const tx = left + (i % 2) * (tileW + 8);
        const ty = y + 52 + Math.floor(i / 2) * (tileH + 8);
        return (
          <g key={s.label} className="hm-pop" style={at(T + 0.4 + i * 0.18)}>
            <rect x={tx} y={ty} width={tileW} height={tileH} rx="6" fill={s.tint} />
            <circle cx={tx + 14} cy={ty + 15} r="8" fill={s.disc} />
            <InfoIcon prims={s.icon} x={tx + 9} y={ty + 10} size={10} colour="white" weight={2.6} />
            <text
              x={tx + 27}
              y={ty + 21}
              fontFamily={FONT}
              fontSize="17"
              fontWeight="800"
              fill={s.ink}
            >
              {s.value}
            </text>
            <text
              x={tx + 8}
              y={ty + 36}
              fontFamily={FONT}
              fontSize="6.5"
              fontWeight="500"
              fill={INK}
            >
              {s.label}
            </text>
          </g>
        );
      })}

      {/* The chart card: its title and axis, then the bars grow and the ring fills. */}
      <g className="hm-pop" style={at(T + 1.4)}>
        <rect
          x={card.x}
          y={card.y}
          width={card.w}
          height={card.h}
          rx="6"
          fill="#f8fafc"
          stroke={HAIRLINE}
          strokeWidth="0.8"
        />
        <text
          x={card.x + 9}
          y={card.y + 15}
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill={INK}
        >
          Projects shipped each quarter
        </text>
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={card.x + 9}
            y1={base - f * BAR_SPAN}
            x2={card.x + 114}
            y2={base - f * BAR_SPAN}
            stroke={HAIRLINE}
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        ))}
        <line
          x1={card.x + 9}
          y1={base}
          x2={card.x + 114}
          y2={base}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        {BARS.map((b, i) => (
          <text
            key={b.q}
            x={card.x + 24 + i * 26}
            y={base + 10}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="6"
            fontWeight="600"
            fill={MUTED}
          >
            {b.q}
          </text>
        ))}
        <circle cx={ring.cx} cy={ring.cy} r={RING_R} fill="none" stroke="#ccfbf1" strokeWidth="7" />
        <text
          x={ring.cx}
          y={ring.cy + 4}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="10.5"
          fontWeight="800"
          fill={INK}
        >
          92%
        </text>
        <text
          x={ring.cx}
          y={base + 10}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="6"
          fontWeight="600"
          fill={MUTED}
        >
          on time
        </text>
      </g>
      {BARS.map((b, i) => {
        const bh = (b.v / BAR_MAX) * BAR_SPAN;
        const last = i === BARS.length - 1;
        return (
          <rect
            key={b.q}
            className="hm-grow"
            style={at(T + 1.8 + i * 0.15)}
            x={card.x + 16 + i * 26}
            y={base - bh}
            width="16"
            height={bh}
            rx="2.5"
            fill={last ? TEAL : '#5eead4'}
          />
        );
      })}
      <text
        className="hm-pop"
        style={at(T + 2.5)}
        x={card.x + 24 + 3 * 26}
        y={base - BAR_SPAN - 4}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="7"
        fontWeight="800"
        fill={TEAL_DEEP}
      >
        16
      </text>
      <circle
        className="hm-draw"
        style={at(T + 2.6, {
          '--dur': '1.1s',
          '--len': RING_LEN,
          '--to': RING_LEN * (1 - RING_SHARE),
        })}
        cx={ring.cx}
        cy={ring.cy}
        r={RING_R}
        fill="none"
        stroke={TEAL}
        strokeWidth="7"
        strokeLinecap="round"
        transform={`rotate(-90 ${ring.cx} ${ring.cy})`}
      />

      <InfoFooter x={x} y={y} n={2} of={of} />

      {/* The teammate selects the chart card: its outline and handles. */}
      <g className="hm-pop" style={at(T + 4.3)}>
        <rect
          x={card.x - 3}
          y={card.y - 3}
          width={card.w + 6}
          height={card.h + 6}
          fill="none"
          stroke={YOU}
          strokeWidth="1.3"
        />
        {[
          [card.x - 3, card.y - 3],
          [card.x + card.w + 3, card.y - 3],
          [card.x - 3, card.y + card.h + 3],
          [card.x + card.w + 3, card.y + card.h + 3],
        ].map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx! - 3}
            y={hy! - 3}
            width="6"
            height="6"
            rx="1.5"
            fill="white"
            stroke={YOU}
            strokeWidth="1.3"
          />
        ))}
      </g>
      <g
        className="hm-cursor"
        style={at(T + 3.6, {
          '--sx': `${left + 150}px`,
          '--sy': `${y + 330}px`,
          '--cx': `${card.x + 58}px`,
          '--cy': `${card.y + 22}px`,
        })}
        aria-hidden
      >
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </InfoSheet>
  );
}
