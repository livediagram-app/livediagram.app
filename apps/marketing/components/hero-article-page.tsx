import { useId, type CSSProperties } from 'react';
import { PAGE, secondPageAt } from './hero-illustrate-page';

// The hero's Article window (docs/specs/019-marketing/marketing-site.md "Hero"): a long read written
// in Illustrate mode (docs/specs/007-editor/article-pages.md). Page 1 opens like a magazine
// feature: a running header, a kicker and a two-line serif headline are typed, the standfirst and
// the byline land, a dusk-over-the-hills header image wipes in with its caption, and the first
// paragraph is written line by line under a drop cap, then a numbered section begins. A teammate
// selects a phrase: the rich-text toolbar opens over it and the phrase turns bold on a highlight.
// The article runs on to page 2: the paragraph continues, a pull quote sets in, a second section and
// a figure whose bars grow, its caption, a margin comment from the teammate, and a caret blinking
// where you are writing. Running footers carry the page numbers. Each piece arrives at its own --d
// delay (hero-mode-animations.css).

const SANS = 'ui-sans-serif, system-ui, sans-serif';
const SERIF = 'Georgia, Cambria, "Times New Roman", serif';
const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';
const RULE = '#e2e8f0';
const BRAND = '#0284c7';
const BRAND_TINT = '#bae6fd';
const WARM = '#f59e0b';
const TEAMMATE = '#ec4899';

// The page's inner margin, and the measure the body copy runs to.
const MARGIN = 18;
const MEASURE = PAGE.w - MARGIN * 2;
const BODY_SIZE = 7.6;
const LEADING = 10.5;

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

// One line of body copy, written out as you type it.
function Line({ x, y, d, text }: { x: number; y: number; d: number; text: string }) {
  return (
    <text
      className="hm-type"
      style={at(d, { '--steps': text.length })}
      x={x}
      y={y}
      fontFamily={SERIF}
      fontSize={BODY_SIZE}
      fill={BODY}
    >
      {text}
    </text>
  );
}

// The paper, its soft shadow, and the editor's label above it.
function Sheet({ x, y, label }: { x: number; y: number; label: string }) {
  const { w, h } = PAGE;
  return (
    <>
      <rect x={x + 1.5} y={y + 3} width={w} height={h} rx="2" fill="#0f172a" opacity="0.07" />
      <rect x={x} y={y} width={w} height={h} rx="2" className="fill-white dark:fill-slate-100" />
      <text x={x} y={y - 8} fontFamily={SANS} fontSize="9" fontWeight="600" fill={MUTED}>
        {label}
      </text>
    </>
  );
}

// The running header (publication and section over a hairline) and footer (site and folio).
function Running({
  x,
  y,
  left,
  right,
  folio,
}: {
  x: number;
  y: number;
  left: string;
  right: string;
  folio: number;
}) {
  const l = x + MARGIN;
  const r = x + PAGE.w - MARGIN;
  return (
    <g fontFamily={SANS} fontSize="6" fill={MUTED}>
      <text x={l} y={y + 15} fontWeight="700" letterSpacing="1.2">
        {left}
      </text>
      <text x={r} y={y + 15} textAnchor="end" letterSpacing="0.4">
        {right}
      </text>
      <path d={`M${l} ${y + 20}H${r}`} stroke={RULE} strokeWidth="0.8" />
      <path d={`M${l} ${y + PAGE.h - 18}H${r}`} stroke={RULE} strokeWidth="0.8" />
      <text x={l} y={y + PAGE.h - 9} letterSpacing="0.3">
        livediagram.app/field-notes
      </text>
      <text x={r} y={y + PAGE.h - 9} textAnchor="end" fontWeight="700" fill={INK}>
        {folio}
      </text>
    </g>
  );
}

// The first paragraph: two lines set beside the drop cap, then the full measure.
const INTRO: [string, number][] = [
  ['very Friday at four we ship whatever', 1],
  ['is ready. No release trains, no freeze,', 1],
];
const SECTION = ['We keep each change small enough to', 'read in one sitting, so a review takes'];
const RUN_ON = [
  'minutes, not days, and nobody dreads',
  'the merge. A Friday release is just the',
  'next small step.',
];
const DEMOS = ['At five the whole team watches one thing', 'go live, then we write down what we'];
const WEEKS = [26, 30, 28, 38, 44, 50, 58, 70];

export function ArticlePage({ portrait = false }: { portrait?: boolean }) {
  // Gradient ids unique per window: the hero and a landing beat can draw this scene on one page.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sky = `art-sky-${uid}`;
  const sun = `art-sun-${uid}`;
  const hill = `art-hill-${uid}`;
  const second = secondPageAt(portrait);
  const { x, y } = PAGE;
  const left = x + MARGIN;
  const img = { y: y + 122, h: 52 };
  const body = y + 200;
  return (
    <>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="0.55" stopColor="#7c3aed" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
        <radialGradient id={sun} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.45" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={hill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c4a6e" />
          <stop offset="1" stopColor="#082f49" />
        </linearGradient>
      </defs>

      <Sheet x={x} y={y} label="Page 1 · Article" />
      <Running x={x} y={y} left="THE SHIP LOG" right="Issue 12 · Autumn" folio={1} />
      <SecondPage {...second} />

      {/* Kicker and the two-line headline, typed. */}
      <text
        className="hm-type"
        style={at(0.3, { '--steps': 24 })}
        x={left}
        y={y + 34}
        fontFamily={SANS}
        fontSize="6.5"
        fontWeight="800"
        letterSpacing="1.4"
        fill={BRAND}
      >
        FIELD NOTES · ENGINEERING
      </text>
      {['How we ship', 'on Fridays'].map((t, i) => (
        <text
          key={t}
          className="hm-type"
          style={at(0.6 + i * 0.4, { '--steps': t.length })}
          x={left - 0.5}
          y={y + 54 + i * 18}
          fontFamily={SERIF}
          fontSize="18"
          fontWeight="700"
          letterSpacing="-0.4"
          fill={INK}
        >
          {t}
        </text>
      ))}

      {/* The standfirst and the byline. */}
      <g
        className="hm-fade"
        style={at(1.4)}
        fontFamily={SERIF}
        fontSize="7.8"
        fontStyle="italic"
        fill={MUTED}
      >
        <text x={left} y={y + 86}>
          A small weekly ritual that made our releases
        </text>
        <text x={left} y={y + 96}>
          boring, in the best possible way.
        </text>
      </g>
      <g className="hm-pop" style={at(1.7)}>
        <circle cx={left + 5.5} cy={y + 109} r="5.5" fill={TEAMMATE} />
        <text
          x={left + 5.5}
          y={y + 109 + 5 * 0.36}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize="5"
          fontWeight="800"
          fill="white"
        >
          MC
        </text>
        <text x={left + 15} y={y + 111.3} fontFamily={SANS} fontSize="6.5" fill={MUTED}>
          <tspan fontWeight="700" fill={INK}>
            Maya Chen
          </tspan>
          {'  ·  Head of Platform  ·  6 min read'}
        </text>
      </g>

      {/* The header image: dusk over the hills, the sun low, a little town's lights below. */}
      <g className="hm-wipe" style={at(2.0)}>
        <rect x={left} y={img.y} width={MEASURE} height={img.h} rx="3" fill={`url(#${sky})`} />
        <circle cx={left + 118} cy={img.y + 40} r="22" fill={`url(#${sun})`} />
        <circle cx={left + 118} cy={img.y + 40} r="7" fill="#fef3c7" />
        <path
          d={`M${left} ${img.y + 42} C ${left + 30} ${img.y + 30}, ${left + 60} ${img.y + 36}, ${left + 92} ${img.y + 44} S ${left + 150} ${img.y + 34}, ${left + MEASURE} ${img.y + 40} V ${img.y + img.h} H ${left} Z`}
          fill="#1d4ed8"
          opacity="0.55"
        />
        <path
          d={`M${left} ${img.y + 50} C ${left + 40} ${img.y + 42}, ${left + 70} ${img.y + 52}, ${left + 110} ${img.y + 48} S ${left + 160} ${img.y + 46}, ${left + MEASURE} ${img.y + 52} V ${img.y + img.h - 3} Q ${left + MEASURE} ${img.y + img.h} ${left + MEASURE - 3} ${img.y + img.h} H ${left + 3} Q ${left} ${img.y + img.h} ${left} ${img.y + img.h - 3} Z`}
          fill={`url(#${hill})`}
        />
        {[22, 30, 37, 128, 136, 141, 149].map((dx, i) => (
          <rect
            key={dx}
            x={left + dx}
            y={img.y + 52 + (i % 2)}
            width="1.6"
            height="1.6"
            rx="0.4"
            fill="#fde68a"
          />
        ))}
      </g>
      <text
        className="hm-fade"
        style={at(2.4)}
        x={left}
        y={img.y + img.h + 9}
        fontFamily={SANS}
        fontSize="6"
        fontStyle="italic"
        fill={MUTED}
      >
        Four o’clock on a Friday, from the office roof.
      </text>

      {/* The first paragraph under a drop cap, written line by line. */}
      <text
        className="hm-pop"
        style={at(2.7)}
        x={left - 1}
        y={body + LEADING - 1}
        fontFamily={SERIF}
        fontSize="25"
        fontWeight="700"
        fill={BRAND}
      >
        E
      </text>
      {INTRO.map(([text], i) => (
        <Line key={text} x={left + 17} y={body + i * LEADING} d={2.9 + i * 0.5} text={text} />
      ))}
      <Line x={left} y={body + 2 * LEADING} d={3.9} text="just a habit the whole team trusts." />

      {/* A numbered section, its rule and its first lines. */}
      <g className="hm-fade" style={at(4.4)}>
        <text
          x={left}
          y={body + 42}
          fontFamily={SANS}
          fontSize="6.5"
          fontWeight="800"
          letterSpacing="0.8"
          fill={WARM}
        >
          01
        </text>
        <text
          x={left + 13}
          y={body + 42}
          fontFamily={SERIF}
          fontSize="10.5"
          fontWeight="700"
          fill={INK}
        >
          Small batches
        </text>
      </g>
      {SECTION.map((text, i) => (
        <Line key={text} x={left} y={body + 55 + i * LEADING} d={4.8 + i * 0.5} text={text} />
      ))}

      {/* The teammate selects "a habit the whole team trusts." (the selection tint), the rich-text
          toolbar opens over it, and Bold and Highlight set it in bold on a warm highlight. */}
      <rect
        className="hm-pop"
        style={at(9.6)}
        x={left + 17.5}
        y={body + 2 * LEADING - 7.5}
        width="114"
        height="10"
        rx="1.5"
        fill="#7dd3fc"
        // fillOpacity, not opacity: the landing animation owns the element's opacity.
        fillOpacity="0.45"
      />
      <g className="hm-pop" style={at(10.6)}>
        <rect
          x={left - 1}
          y={body + 2 * LEADING - 8}
          width={MEASURE}
          height="11"
          className="fill-white dark:fill-slate-100"
        />
        <rect
          x={left + 17}
          y={body + 2 * LEADING - 7.5}
          width="121"
          height="10"
          rx="1.5"
          fill="#fde68a"
        />
        <text x={left} y={body + 2 * LEADING} fontFamily={SERIF} fontSize={BODY_SIZE} fill={BODY}>
          just{' '}
          <tspan fontWeight="700" fill={INK}>
            a habit the whole team trusts.
          </tspan>
        </text>
      </g>
      <Toolbar x={left + 22} y={body + 2 * LEADING - 30} />
      <g className="hm-cursor" style={at(9.1, CURSOR(left, body + 2 * LEADING))} aria-hidden>
        <path
          d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
          fill={TEAMMATE}
          stroke="white"
          strokeWidth="1"
        />
        <rect x="10" y="12" width="20" height="12" rx="3" fill={TEAMMATE} />
        <text
          x="20"
          y="21"
          textAnchor="middle"
          fontFamily={SANS}
          fontSize="7.5"
          fontWeight="700"
          fill="white"
        >
          JR
        </text>
      </g>
    </>
  );
}

// The rich-text toolbar the selection opens: Bold (pressed), Italic, Underline, a divider, the
// highlighter in its warm swatch, and Link.
function Toolbar({ x, y }: { x: number; y: number }) {
  return (
    <g className="hm-select" style={at(9.8)} fontFamily={SANS}>
      <rect
        x={x}
        y={y}
        width="104"
        height="19"
        rx="5"
        className="fill-slate-900 dark:fill-slate-700"
      />
      <rect x={x + 3} y={y + 3} width="15" height="13" rx="3" fill="#0ea5e9" />
      <text
        x={x + 10.5}
        y={y + 12.8}
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="800"
        fill="white"
      >
        B
      </text>
      <text
        x={x + 27}
        y={y + 12.8}
        textAnchor="middle"
        fontSize="8.5"
        fontStyle="italic"
        fontFamily={SERIF}
        fill="#e2e8f0"
      >
        I
      </text>
      <text
        x={x + 41}
        y={y + 12.8}
        textAnchor="middle"
        fontSize="8.5"
        textDecoration="underline"
        fill="#e2e8f0"
      >
        U
      </text>
      <path d={`M${x + 51} ${y + 5}V${y + 14}`} stroke="#475569" strokeWidth="0.8" />
      <rect x={x + 57} y={y + 5.5} width="12" height="8" rx="2" fill="#fde68a" />
      <path
        d={`M${x + 60} ${y + 11.5}h6`}
        stroke="#92400e"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d={`M${x + 80} ${y + 11} l3 -3 M${x + 78.5} ${y + 9.5} a2 2 0 0 1 0 -2.8 l1.2 -1.2 a2 2 0 0 1 2.8 2.8 M${x + 84.5} ${y + 8.5} a2 2 0 0 1 0 2.8 l-1.2 1.2 a2 2 0 0 1 -2.8 -2.8`}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d={`M${x + 93} ${y + 8}l2.5 2.5 2.5-2.5`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </g>
  );
}

// The teammate's cursor comes in from the right and stops at the end of the selected phrase.
const CURSOR = (left: number, lineY: number) => ({
  '--sx': `${left + 260}px`,
  '--sy': `${lineY + 60}px`,
  '--cx': `${left + 134}px`,
  '--cy': `${lineY + 1}px`,
});

// Page 2: the paragraph runs on, a pull quote, a second section and a figure with its caption, the
// teammate's margin comment, and the caret where you are writing.
function SecondPage({ x, y }: { x: number; y: number }) {
  const left = x + MARGIN;
  const fig = { y: y + 172, h: 76 };
  const plot = { x: left + 10, y: fig.y + 26, w: MEASURE - 20, h: 34 };
  const step = plot.w / WEEKS.length;
  const demosEnd = y + 156 + LEADING;
  return (
    <>
      <Sheet x={x} y={y} label="Page 2 · Article" />
      <Running x={x} y={y} left="HOW WE SHIP ON FRIDAYS" right="Field notes" folio={2} />

      {RUN_ON.map((text, i) => (
        <Line key={text} x={left} y={y + 36 + i * LEADING} d={6.4 + i * 0.4} text={text} />
      ))}

      {/* The pull quote, between hairlines, with its attribution. */}
      <g className="hm-pop" style={at(7.4)}>
        <path
          d={`M${left} ${y + 74}H${left + MEASURE}M${left} ${y + 128}H${left + MEASURE}`}
          stroke={WARM}
          strokeWidth="0.9"
        />
        <text x={left - 1} y={y + 98} fontFamily={SERIF} fontSize="30" fill={WARM} opacity="0.85">
          “
        </text>
        <g fontFamily={SERIF} fontSize="11" fontStyle="italic" fill={INK}>
          <text x={left + 16} y={y + 92}>
            Ship small, ship often, and
          </text>
          <text x={left + 16} y={y + 106}>
            Friday takes care of itself.
          </text>
        </g>
        <text
          x={left + 16}
          y={y + 120}
          fontFamily={SANS}
          fontSize="6"
          fontWeight="700"
          letterSpacing="1.1"
          fill={MUTED}
        >
          MAYA CHEN, HEAD OF PLATFORM
        </text>
      </g>

      {/* The second section. */}
      <g className="hm-fade" style={at(7.9)}>
        <text
          x={left}
          y={y + 145}
          fontFamily={SANS}
          fontSize="6.5"
          fontWeight="800"
          letterSpacing="0.8"
          fill={WARM}
        >
          02
        </text>
        <text
          x={left + 13}
          y={y + 145}
          fontFamily={SERIF}
          fontSize="10.5"
          fontWeight="700"
          fill={INK}
        >
          Friday demos
        </text>
      </g>
      {DEMOS.map((text, i) => (
        <Line key={text} x={left} y={y + 156 + i * LEADING} d={8.2 + i * 0.4} text={text} />
      ))}
      {/* Where you are writing: the end of the paragraph. */}
      <rect
        className="hm-caret"
        style={at(9.0)}
        x={left + 124}
        y={demosEnd - 7.5}
        width="1.1"
        height="9.5"
        fill={BRAND}
      />

      {/* The figure: releases per week, the last bar called out, then its caption. */}
      <g className="hm-fade" style={at(8.7)}>
        <rect
          x={left}
          y={fig.y}
          width={MEASURE}
          height={fig.h}
          rx="3"
          fill="#f8fafc"
          stroke={RULE}
          strokeWidth="0.8"
        />
        <text
          x={left + 10}
          y={fig.y + 12}
          fontFamily={SANS}
          fontSize="6.5"
          fontWeight="700"
          fill={INK}
        >
          Releases per week
        </text>
        {['W1', 'W8'].map((t, i) => (
          <text
            key={t}
            x={plot.x + (i ? plot.w - step / 2 : step / 2)}
            y={plot.y + plot.h + 8}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize="6"
            fill={MUTED}
          >
            {t}
          </text>
        ))}
        {[0, 0.5, 1].map((t) => (
          <path
            key={t}
            d={`M${plot.x} ${plot.y + plot.h * t}H${plot.x + plot.w}`}
            stroke={t === 1 ? '#cbd5e1' : RULE}
            strokeWidth="0.7"
            strokeDasharray={t === 1 ? undefined : '2 2'}
          />
        ))}
      </g>
      {WEEKS.map((v, i) => {
        const bh = (v / 70) * plot.h;
        const last = i === WEEKS.length - 1;
        return (
          <rect
            key={i}
            className="hm-grow"
            style={at(8.9 + i * 0.07)}
            x={plot.x + i * step + step * 0.22}
            y={plot.y + plot.h - bh}
            width={step * 0.56}
            height={bh}
            rx="1.5"
            fill={last ? BRAND : BRAND_TINT}
          />
        );
      })}
      <g className="hm-pop" style={at(9.6)}>
        <rect
          x={plot.x + plot.w - step / 2 - 15}
          y={plot.y - 14}
          width="30"
          height="10"
          rx="5"
          fill={WARM}
        />
        <text
          x={plot.x + plot.w - step / 2}
          y={plot.y - 7}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize="6"
          fontWeight="800"
          fill="white"
        >
          +170%
        </text>
      </g>
      <text
        className="hm-fade"
        style={at(9.4)}
        x={left}
        y={fig.y + fig.h + 10}
        fontFamily={SANS}
        fontSize="6"
        fill={MUTED}
      >
        <tspan fontWeight="700" fill={BODY}>
          Fig. 1
        </tspan>
        {'  Releases per week since Fridays began.'}
      </text>

      {/* The teammate's comment on "go live", its marker in the margin. */}
      <g className="hm-pop" style={at(10.2)}>
        <rect x={left} y={demosEnd + 1.5} width="19" height="1.2" fill={TEAMMATE} opacity="0.7" />
        <circle cx={x + PAGE.w - 8} cy={demosEnd - 2.5} r="4" fill={TEAMMATE} />
        <text
          x={x + PAGE.w - 8}
          y={demosEnd - 0.7}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize="5"
          fontWeight="800"
          fill="white"
        >
          1
        </text>
      </g>
    </>
  );
}
