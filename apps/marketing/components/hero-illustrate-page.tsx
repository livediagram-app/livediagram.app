import type { CSSProperties } from 'react';

// The hero's Infographic window (docs/specs/019-marketing/marketing-site.md "Hero"): a two-page
// infographic laid out in Illustrate mode (docs/specs/007-editor/editor-modes.md "The pages"), the
// pages side by side in a row. On page 1 a colour band and title land, then a headline number,
// three stat chips, a bar chart whose bars grow and a donut that fills, and the teammate selects
// the chart, handles and all; then page 2 fills in: its band and title, a roadmap whose line draws
// through three milestones, and a pull quote. Each piece arrives at its own --d delay
// (hero-mode-animations.css).

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const BRAND = '#0ea5e9';
const DEEP = '#075985';
const MUTED = '#64748b';

// The page: A4 portrait at the mock's scale (210 x 297).
const PAGE = { x: 85, y: -24, w: 210, h: 297 };
// The gap between pages in the row.
const PAGE_GAP = 30;

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

const STATS = [
  { value: '12', label: 'releases', color: '#8b5cf6' },
  { value: '48', label: 'people', color: '#ec4899' },
  { value: '99%', label: 'uptime', color: '#10b981' },
];

const BARS = [34, 48, 42, 62, 78];

export function InfographicPages() {
  const { x, y, w } = PAGE;
  const left = x + 18;
  return (
    <>
      {/* The page itself, a white sheet with its shadow. */}
      <Sheet x={x} n={1} />

      {/* Header band and title. */}
      <g className="hm-wipe" style={at(0.3)}>
        <rect x={x} y={y} width={w} height="62" rx="2" fill={BRAND} />
        <rect x={x} y={y + 52} width={w} height="10" fill={BRAND} />
      </g>
      <g className="hm-pop" style={at(0.8)}>
        <text
          x={left}
          y={y + 26}
          fontFamily={FONT}
          fontSize="8"
          fontWeight="700"
          fill="#e0f2fe"
          letterSpacing="1.5"
        >
          2026 IN REVIEW
        </text>
        <text x={left} y={y + 46} fontFamily={FONT} fontSize="17" fontWeight="800" fill="white">
          Our year in numbers
        </text>
      </g>

      {/* The headline number. */}
      <g className="hm-pop" style={at(1.5)}>
        <text x={left} y={y + 112} fontFamily={FONT} fontSize="40" fontWeight="800" fill={DEEP}>
          3×
        </text>
        <text
          x={left + 58}
          y={y + 92}
          fontFamily={FONT}
          fontSize="10"
          fontWeight="700"
          fill="#0f172a"
        >
          faster launches
        </text>
        <text x={left + 58} y={y + 106} fontFamily={FONT} fontSize="8" fill={MUTED}>
          than the year before
        </text>
      </g>

      {/* Three stat chips. */}
      {STATS.map((s, i) => {
        const cx = left + i * 60;
        return (
          <g key={s.label} className="hm-pop" style={at(2.1 + i * 0.25)}>
            <rect x={cx} y={y + 126} width="52" height="40" rx="7" fill={s.color} opacity="0.12" />
            <circle cx={cx + 12} cy={y + 139} r="5" fill={s.color} />
            <text
              x={cx + 21}
              y={y + 142}
              fontFamily={FONT}
              fontSize="11"
              fontWeight="800"
              fill="#0f172a"
            >
              {s.value}
            </text>
            <text x={cx + 8} y={y + 158} fontFamily={FONT} fontSize="7.5" fill={MUTED}>
              {s.label}
            </text>
          </g>
        );
      })}

      {/* A bar chart: the axis, then each bar grows from it. */}
      <g className="hm-pop" style={at(3.2)}>
        <text x={left} y={y + 186} fontFamily={FONT} fontSize="8" fontWeight="700" fill="#0f172a">
          Launches per quarter
        </text>
        <line
          x1={left}
          y1={y + 272}
          x2={left + 104}
          y2={y + 272}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
      </g>
      {BARS.map((bh, i) => (
        <rect
          key={i}
          className="hm-grow"
          style={at(3.5 + i * 0.15)}
          x={left + 4 + i * 20}
          y={y + 272 - bh}
          width="13"
          height={bh}
          rx="2"
          fill={i === BARS.length - 1 ? BRAND : '#bae6fd'}
        />
      ))}

      {/* A donut that fills to its share. */}
      <g className="hm-pop" style={at(4.4)}>
        <circle cx={x + 166} cy={y + 228} r="22" fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <text
          x={x + 166}
          y={y + 232}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="10"
          fontWeight="800"
          fill="#0f172a"
        >
          72%
        </text>
        <text
          x={x + 166}
          y={y + 266}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fill={MUTED}
        >
          on time
        </text>
      </g>
      <circle
        className="hm-draw"
        style={at(4.7, { '--dur': '1s', '--len': 138, '--to': 38 })}
        cx={x + 166}
        cy={y + 228}
        r="22"
        fill="none"
        stroke="#10b981"
        strokeWidth="9"
        transform={`rotate(-90 ${x + 166} ${y + 228})`}
      />

      {/* The teammate selects the chart: its outline and handles. */}
      <g className="hm-pop" style={at(6.2)}>
        <rect
          x={left - 4}
          y={y + 176}
          width="116"
          height="102"
          fill="none"
          stroke={BRAND}
          strokeWidth="1.5"
        />
        {[
          [left - 4, y + 176],
          [left + 112, y + 176],
          [left - 4, y + 278],
          [left + 112, y + 278],
        ].map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx! - 3.5}
            y={hy! - 3.5}
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            stroke={BRAND}
            strokeWidth="1.5"
          />
        ))}
      </g>
      <g
        className="hm-cursor"
        style={at(5.6, {
          '--sx': `${left + 162}px`,
          '--sy': `${y + 166}px`,
          '--cx': `${left + 90}px`,
          '--cy': `${y + 218}px`,
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

      <SecondPage x={x + w + PAGE_GAP} />
    </>
  );
}

// A page: a white sheet with its shadow and its name above it.
function Sheet({ x, n }: { x: number; n: number }) {
  const { y, w, h } = PAGE;
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

const VIOLET = '#8b5cf6';
const MILESTONES = [
  { when: 'Q1', what: 'Launch in EU' },
  { when: 'Q2', what: 'Mobile app' },
  { when: 'Q3', what: '1M people' },
];

// Page 2, "Looking ahead": a band and title, a roadmap whose line draws through three milestones,
// and a pull quote.
function SecondPage({ x }: { x: number }) {
  const { y, w } = PAGE;
  const left = x + 18;
  const lineY = y + 128;
  return (
    <>
      <Sheet x={x} n={2} />
      <g className="hm-wipe" style={at(6.4)}>
        <rect x={x} y={y} width={w} height="62" rx="2" fill={VIOLET} />
        <rect x={x} y={y + 52} width={w} height="10" fill={VIOLET} />
      </g>
      <g className="hm-pop" style={at(6.8)}>
        <text
          x={left}
          y={y + 26}
          fontFamily={FONT}
          fontSize="8"
          fontWeight="700"
          fill="#ede9fe"
          letterSpacing="1.5"
        >
          2027 PLAN
        </text>
        <text x={left} y={y + 46} fontFamily={FONT} fontSize="17" fontWeight="800" fill="white">
          Looking ahead
        </text>
        <text x={left} y={y + 92} fontFamily={FONT} fontSize="10" fontWeight="700" fill="#0f172a">
          The roadmap
        </text>
      </g>
      <path
        className="hm-draw"
        style={at(7.1, { '--dur': '0.9s', '--len': 160 })}
        d={`M${left + 8} ${lineY} H${left + 168}`}
        stroke="#ddd6fe"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {MILESTONES.map((m, i) => {
        const cx = left + 14 + i * 74;
        return (
          <g key={m.when} className="hm-pop" style={at(7.3 + i * 0.3)}>
            <circle cx={cx} cy={lineY} r="9" fill={VIOLET} />
            <text
              x={cx}
              y={lineY + 3}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="7"
              fontWeight="800"
              fill="white"
            >
              {m.when}
            </text>
            <text
              x={cx}
              y={lineY + 24}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="7.5"
              fontWeight="600"
              fill="#334155"
            >
              {m.what}
            </text>
          </g>
        );
      })}
      <g className="hm-pop" style={at(8.5)}>
        <rect x={left} y={y + 176} width="174" height="76" rx="8" fill={VIOLET} opacity="0.1" />
        <text x={left + 10} y={y + 206} fontFamily="Georgia, serif" fontSize="30" fill={VIOLET}>
          “
        </text>
        <text
          x={left + 30}
          y={y + 202}
          fontFamily={FONT}
          fontSize="11"
          fontWeight="700"
          fill="#0f172a"
        >
          Our best year yet,
        </text>
        <text
          x={left + 30}
          y={y + 217}
          fontFamily={FONT}
          fontSize="11"
          fontWeight="700"
          fill="#0f172a"
        >
          and we did it together.
        </text>
        <text x={left + 30} y={y + 236} fontFamily={FONT} fontSize="8" fill={MUTED}>
          Maya Chen, CEO
        </text>
      </g>
    </>
  );
}
