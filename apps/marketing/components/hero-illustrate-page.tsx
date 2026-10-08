import type { CSSProperties } from 'react';

// The hero's Infographic window (docs/specs/019-marketing/marketing-site.md "Hero"): a two-page
// year-in-review laid out in Illustrate mode (docs/specs/007-editor/editor-modes.md "The pages"),
// the pages side by side in a row, set like a printed annual report. On page 1 a thin accent rule
// lands, then the kicker and headline, a display figure with its change, three stats each with a
// sparkline, and a chart card whose bars grow and whose ring fills; the teammate selects the card,
// handles and all. Then page 2: its headline, a timeline whose rail draws through three
// milestones, a pull quote with its attribution, and next year's targets. Both pages close on a footer and a page
// number. Each piece arrives at its own --d delay (hero-mode-animations.css).

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

// The palette: ink, the brand sky, one second accent (indigo, page 2) and one for growth.
const INK = '#0b2545';
const MUTED = '#64748b';
const HAIRLINE = '#e2e8f0';
const SKY = '#0ea5e9';
const SKY_DEEP = '#0369a1';
const SKY_TINT = '#e0f2fe';
const SKY_SOFT = '#bae6fd';
const INDIGO = '#6366f1';
const INDIGO_TINT = '#eef2ff';
const INDIGO_SOFT = '#c7d2fe';
const GROWTH = '#059669';
const GROWTH_TINT = '#d1fae5';
const CARD = '#f8fafc';

// The page: A4 portrait at the mock's scale (210 x 297).
export const PAGE = { x: 85, y: -24, w: 210, h: 297 };
// The gap between pages in the row.
const PAGE_GAP = 30;
// The page's margin: every block on it starts here and ends this far from the right edge.
const MARGIN = 16;
const CONTENT = PAGE.w - MARGIN * 2;

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

// The stats row: a figure, its label and a sparkline of the year (points as 0 to 1 heights).
const STATS = [
  { value: '124', label: 'RELEASES', color: SKY, spark: [0.2, 0.35, 0.3, 0.55, 0.7, 1] },
  { value: '48', label: 'TEAMMATES', color: INDIGO, spark: [0.3, 0.3, 0.5, 0.55, 0.8, 0.9] },
  { value: '99.98%', label: 'UPTIME', color: GROWTH, spark: [0.85, 0.9, 0.8, 0.95, 0.9, 1] },
];

// Launches per quarter, the last one called out.
const BARS = [
  { q: 'Q1', v: 18 },
  { q: 'Q2', v: 26 },
  { q: 'Q3', v: 35 },
  { q: 'Q4', v: 48 },
];
const BAR_MAX = 48;
const BAR_SPAN = 44;

// The ring: its radius, circumference, and the share it fills to.
const RING_R = 19;
const RING_LEN = 2 * Math.PI * RING_R;
const RING_SHARE = 0.92;

// Where page 2 sits: beside page 1 in the row, or under it on a phone (the portrait layout).
export function secondPageAt(portrait: boolean) {
  return portrait
    ? { x: PAGE.x, y: PAGE.y + PAGE.h + PAGE_GAP - 4 }
    : { x: PAGE.x + PAGE.w + PAGE_GAP, y: PAGE.y };
}

export function InfographicPages({ portrait = false }: { portrait?: boolean }) {
  const { x, y, w } = PAGE;
  const left = x + MARGIN;
  const right = left + CONTENT;
  const column = CONTENT / STATS.length;
  // The chart card.
  const card = { x: left, y: y + 180, w: CONTENT, h: 92 };
  const base = card.y + 74;
  const ring = { cx: card.x + 146, cy: card.y + 44 };
  return (
    <>
      <Sheet x={x} y={y} n={1} />

      {/* The accent rule across the top of the page. */}
      <rect className="hm-wipe" style={at(0.3)} x={x} y={y} width={w} height="4" fill={SKY} />

      {/* Kicker and headline. */}
      <g className="hm-pop" style={at(0.7)}>
        <text
          x={left}
          y={y + 22}
          fontFamily={FONT}
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="1.3"
          fill={SKY_DEEP}
        >
          ANNUAL REPORT · 2026
        </text>
        <text x={left} y={y + 42} fontFamily={FONT} fontSize="16" fontWeight="800" fill={INK}>
          A year of shipping,
        </text>
        <text x={left} y={y + 60} fontFamily={FONT} fontSize="16" fontWeight="800" fill={INK}>
          three times faster
        </text>
        <line x1={left} y1={y + 72} x2={right} y2={y + 72} stroke={HAIRLINE} strokeWidth="1" />
      </g>

      {/* The display figure, what it measures and its change. */}
      <g className="hm-pop" style={at(1.3)}>
        <text
          x={left - 1.5}
          y={y + 116}
          fontFamily={FONT}
          fontSize="40"
          fontWeight="800"
          letterSpacing="-1.5"
          fill={SKY_DEEP}
        >
          3.2×
        </text>
        <text x={left + 90} y={y + 94} fontFamily={FONT} fontSize="8.5" fontWeight="700" fill={INK}>
          faster from idea
        </text>
        <text
          x={left + 90}
          y={y + 105}
          fontFamily={FONT}
          fontSize="8.5"
          fontWeight="700"
          fill={INK}
        >
          to launch
        </text>
        <rect x={left + 90} y={y + 110} width="50" height="11" rx="5.5" fill={GROWTH_TINT} />
        <path d={`M${left + 95} ${y + 118.5} l3 -4.5 l3 4.5 z`} fill={GROWTH} />
        <text
          x={left + 104}
          y={y + 118}
          fontFamily={FONT}
          fontSize="6.5"
          fontWeight="700"
          fill={GROWTH}
        >
          38% YoY
        </text>
      </g>

      {/* Three stats, each a figure, a label and a sparkline, divided by hairlines. */}
      {STATS.map((s, i) => {
        const sx = left + i * column + (i === 0 ? 0 : 8);
        const sparkW = column - 16;
        const points = s.spark
          .map((v, j) => `${sx + (j * sparkW) / (s.spark.length - 1)},${y + 172 - v * 9}`)
          .join(' ');
        return (
          <g key={s.label} className="hm-pop" style={at(1.9 + i * 0.2)}>
            {i > 0 ? (
              <line
                x1={left + i * column}
                y1={y + 134}
                x2={left + i * column}
                y2={y + 172}
                stroke={HAIRLINE}
                strokeWidth="1"
              />
            ) : null}
            <text
              x={sx}
              y={y + 147}
              fontFamily={FONT}
              fontSize={s.value.length > 4 ? 12 : 14}
              fontWeight="800"
              fill={INK}
            >
              {s.value}
            </text>
            <text
              x={sx}
              y={y + 156}
              fontFamily={FONT}
              fontSize="6"
              fontWeight="600"
              letterSpacing="0.6"
              fill={MUTED}
            >
              {s.label}
            </text>
            <polyline
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* The chart card: its title, gridlines and axis, then the bars grow and the ring fills. */}
      <g className="hm-pop" style={at(2.9)}>
        <rect x={card.x} y={card.y} width={card.w} height={card.h} rx="5" fill={CARD} />
        <text
          x={card.x + 9}
          y={card.y + 14}
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill={INK}
        >
          Launches per quarter
        </text>
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={card.x + 9}
            y1={base - f * BAR_SPAN}
            x2={card.x + 112}
            y2={base - f * BAR_SPAN}
            stroke={HAIRLINE}
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        ))}
        <line
          x1={card.x + 9}
          y1={base}
          x2={card.x + 112}
          y2={base}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        {BARS.map((b, i) => (
          <text
            key={b.q}
            x={card.x + 23 + i * 25}
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
        <circle
          cx={ring.cx}
          cy={ring.cy}
          r={RING_R}
          fill="none"
          stroke={SKY_TINT}
          strokeWidth="7"
        />
        <text
          x={ring.cx}
          y={ring.cy + 4}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="11"
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
          shipped on time
        </text>
      </g>
      {BARS.map((b, i) => {
        const bh = (b.v / BAR_MAX) * BAR_SPAN;
        const last = i === BARS.length - 1;
        return (
          <rect
            key={b.q}
            className="hm-grow"
            style={at(3.3 + i * 0.15)}
            x={card.x + 16 + i * 25}
            y={base - bh}
            width="14"
            height={bh}
            rx="2"
            fill={last ? SKY : SKY_SOFT}
          />
        );
      })}
      <text
        className="hm-pop"
        style={at(4.1)}
        x={card.x + 23 + 3 * 25}
        y={base - BAR_SPAN - 4}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="6.5"
        fontWeight="800"
        fill={SKY_DEEP}
      >
        48
      </text>
      <circle
        className="hm-draw"
        style={at(4.4, { '--dur': '1s', '--len': RING_LEN, '--to': RING_LEN * (1 - RING_SHARE) })}
        cx={ring.cx}
        cy={ring.cy}
        r={RING_R}
        fill="none"
        stroke={SKY}
        strokeWidth="7"
        strokeLinecap="round"
        transform={`rotate(-90 ${ring.cx} ${ring.cy})`}
      />

      <Footer x={x} y={y} n={1} />

      {/* The teammate selects the chart card: its outline and handles. */}
      <g className="hm-pop" style={at(6.2)}>
        <rect
          x={card.x - 3}
          y={card.y - 3}
          width={card.w + 6}
          height={card.h + 6}
          fill="none"
          stroke={SKY}
          strokeWidth="1.5"
        />
        {[
          [card.x - 3, card.y - 3],
          [card.x + card.w + 3, card.y - 3],
          [card.x - 3, card.y + card.h + 3],
          [card.x + card.w + 3, card.y + card.h + 3],
        ].map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx! - 3.5}
            y={hy! - 3.5}
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            stroke={SKY}
            strokeWidth="1.5"
          />
        ))}
      </g>
      <g
        className="hm-cursor"
        style={at(5.6, {
          '--sx': `${left + 168}px`,
          '--sy': `${y + 150}px`,
          '--cx': `${card.x + 58}px`,
          '--cy': `${card.y + 28}px`,
        })}
        aria-hidden
      >
        <path
          d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
          fill="#ec4899"
          stroke="white"
          strokeWidth="1"
        />
        <rect x="10" y="12" width="20" height="12" rx="3" fill="#ec4899" />
        <text
          x="20"
          y="21"
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill="white"
        >
          JR
        </text>
      </g>

      <SecondPage {...secondPageAt(portrait)} />
    </>
  );
}

// A page: a white sheet with its shadow and its name above it.
function Sheet({ x, y, n }: { x: number; y: number; n: number }) {
  const { w, h } = PAGE;
  return (
    <>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx="2" fill="#0f172a" opacity="0.08" />
      <rect x={x} y={y} width={w} height={h} rx="2" className="fill-white dark:fill-slate-100" />
      <text x={x} y={y - 8} fontFamily={FONT} fontSize="9" fontWeight="600" fill={MUTED}>
        Page {n} · A4
      </text>
    </>
  );
}

// The running footer every page closes on: a hairline, the report's name and the page number.
function Footer({ x, y, n }: { x: number; y: number; n: number }) {
  const left = x + MARGIN;
  const right = left + CONTENT;
  const fy = y + PAGE.h - 16;
  return (
    <g>
      <line x1={left} y1={fy} x2={right} y2={fy} stroke={HAIRLINE} strokeWidth="1" />
      <text
        x={left}
        y={fy + 9}
        fontFamily={FONT}
        fontSize="6"
        fontWeight="600"
        letterSpacing="0.6"
        fill={MUTED}
      >
        YEAR IN REVIEW
      </text>
      <text
        x={right}
        y={fy + 9}
        textAnchor="end"
        fontFamily={FONT}
        fontSize="6"
        fontWeight="700"
        fill={INK}
      >
        {String(n).padStart(2, '0')}
      </text>
    </g>
  );
}

const MILESTONES = [
  { when: 'Q1', what: 'Launch in the EU', detail: 'Data stays in Frankfurt' },
  { when: 'Q2', what: 'Native mobile apps', detail: 'iOS and Android, offline first' },
  { when: 'Q3', what: 'One million people', detail: 'Free for everyone, always' },
];

// Next year's targets on page 2, as progress toward each.
const TARGETS = [
  { label: 'COUNTRIES', value: '12 of 20', share: 0.6 },
  { label: 'TEAMS', value: '64%', share: 0.64 },
];

// Page 2, "Where we go next": the headline, a timeline whose rail draws through three
// milestones, a pull quote with its attribution, and next year's targets.
function SecondPage({ x, y }: { x: number; y: number }) {
  const { w } = PAGE;
  const left = x + MARGIN;
  const right = left + CONTENT;
  const railX = left + 5;
  const firstY = y + 92;
  const step = 30;
  const quoteY = y + 194;
  const targetsY = y + 256;
  return (
    <>
      <Sheet x={x} y={y} n={2} />
      <rect className="hm-wipe" style={at(6.4)} x={x} y={y} width={w} height="4" fill={INDIGO} />
      <g className="hm-pop" style={at(6.7)}>
        <text
          x={left}
          y={y + 22}
          fontFamily={FONT}
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="1.3"
          fill={INDIGO}
        >
          2027 OUTLOOK
        </text>
        <text x={left} y={y + 42} fontFamily={FONT} fontSize="16" fontWeight="800" fill={INK}>
          Where we go next
        </text>
        <text x={left} y={y + 58} fontFamily={FONT} fontSize="8" fill={MUTED}>
          Three milestones for the year ahead
        </text>
        <line x1={left} y1={y + 72} x2={right} y2={y + 72} stroke={HAIRLINE} strokeWidth="1" />
      </g>

      {/* The timeline's rail draws down, then each milestone lands on it. */}
      <path
        className="hm-draw"
        style={at(7, { '--dur': '0.9s', '--len': step * 2 })}
        d={`M${railX} ${firstY} V${firstY + step * 2}`}
        stroke={INDIGO_SOFT}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {MILESTONES.map((m, i) => {
        const my = firstY + i * step;
        const done = i === 0;
        return (
          <g key={m.when} className="hm-pop" style={at(7.2 + i * 0.3)}>
            <circle
              cx={railX}
              cy={my}
              r="4.5"
              fill={done ? INDIGO : 'white'}
              stroke={INDIGO}
              strokeWidth="2"
            />
            <rect x={left + 16} y={my - 9} width="20" height="11" rx="5.5" fill={INDIGO_TINT} />
            <text
              x={left + 26}
              y={my - 1}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="6.5"
              fontWeight="800"
              fill={INDIGO}
            >
              {m.when}
            </text>
            <text
              x={left + 42}
              y={my - 0.5}
              fontFamily={FONT}
              fontSize="9"
              fontWeight="700"
              fill={INK}
            >
              {m.what}
            </text>
            <text x={left + 42} y={my + 10} fontFamily={FONT} fontSize="7" fill={MUTED}>
              {m.detail}
            </text>
          </g>
        );
      })}

      {/* The pull quote: an accent rule, the quote set in serif, and who said it. */}
      <g className="hm-pop" style={at(8.4)}>
        <rect x={left} y={quoteY - 18} width="3" height="62" rx="1.5" fill={INDIGO} />
        <text x={left + 12} y={quoteY + 4} fontFamily={SERIF} fontSize="30" fill={INDIGO_SOFT}>
          “
        </text>
        <text
          x={left + 30}
          y={quoteY - 2}
          fontFamily={SERIF}
          fontSize="11"
          fontStyle="italic"
          fill={INK}
        >
          Our best year yet,
        </text>
        <text
          x={left + 30}
          y={quoteY + 12}
          fontFamily={SERIF}
          fontSize="11"
          fontStyle="italic"
          fill={INK}
        >
          and we built it together.
        </text>
        <circle cx={left + 37} cy={quoteY + 32} r="7" fill={INDIGO} />
        <text
          x={left + 37}
          y={quoteY + 32 + 6 * 0.36}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="6"
          fontWeight="700"
          fill="white"
        >
          MC
        </text>
        <text
          x={left + 49}
          y={quoteY + 30}
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill={INK}
        >
          Maya Chen
        </text>
        <text x={left + 49} y={quoteY + 39} fontFamily={FONT} fontSize="6.5" fill={MUTED}>
          Chief Executive
        </text>
      </g>

      {/* Next year's targets: two progress bars side by side. */}
      <g className="hm-pop" style={at(8.9)}>
        {TARGETS.map((t, i) => {
          const tx = left + i * (CONTENT / 2 + 4);
          const tw = CONTENT / 2 - 4;
          return (
            <g key={t.label}>
              <text
                x={tx}
                y={targetsY}
                fontFamily={FONT}
                fontSize="6"
                fontWeight="600"
                letterSpacing="0.6"
                fill={MUTED}
              >
                {t.label}
              </text>
              <text
                x={tx + tw}
                y={targetsY}
                textAnchor="end"
                fontFamily={FONT}
                fontSize="6.5"
                fontWeight="800"
                fill={INK}
              >
                {t.value}
              </text>
              <rect x={tx} y={targetsY + 4} width={tw} height="4" rx="2" fill={INDIGO_TINT} />
              <rect
                x={tx}
                y={targetsY + 4}
                width={tw * t.share}
                height="4"
                rx="2"
                fill={i === 0 ? INDIGO : SKY}
              />
            </g>
          );
        })}
      </g>

      <Footer x={x} y={y} n={2} />
    </>
  );
}
