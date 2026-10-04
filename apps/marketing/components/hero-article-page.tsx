import type { CSSProperties } from 'react';

// The hero's Article window (docs/specs/019-marketing/marketing-site.md "Hero"): an article page
// written in Illustrate mode (docs/specs/007-editor/illustrate-pages.md, an article page's kind). A
// kicker and a serif title are typed, the byline and a header image land, the paragraphs are written
// line by line under a numbered heading, a pull quote sets in, and the teammate selects a phrase:
// the rich-text toolbar opens over it and the phrase turns bold and highlighted. A caret blinks
// where you are writing. Each piece arrives at its own --d delay (hero-mode-animations.css).

const SANS = 'ui-sans-serif, system-ui, sans-serif';
const SERIF = 'Georgia, Cambria, serif';
const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';
const BRAND = '#0ea5e9';

// The page: A4 portrait at the mock's scale.
const PAGE = { x: 195, y: -46, w: 210, h: 297 };

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
      fontSize="8.5"
      fill={BODY}
    >
      {text}
    </text>
  );
}

const INTRO = [
  'Every Friday at four, we ship whatever',
  'is ready. No release trains, no freeze,',
  'just a habit the whole team trusts.',
];
const SECTION = [
  'We keep changes small enough to read',
  'in one sitting, so a review takes',
  'minutes, not days.',
];

export function ArticlePage() {
  const { x, y, w, h } = PAGE;
  const left = x + 20;
  return (
    <>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx="2" fill="#0f172a" opacity="0.08" />
      <rect x={x} y={y} width={w} height={h} rx="2" className="fill-white dark:fill-slate-100" />
      <text x={x} y={y - 8} fontFamily={SANS} fontSize="9" fontWeight="600" fill={MUTED}>
        Page 1 · Article
      </text>

      {/* Kicker and title, typed. */}
      <text
        className="hm-type"
        style={at(0.3, { '--steps': 11 })}
        x={left}
        y={y + 24}
        fontFamily={SANS}
        fontSize="7.5"
        fontWeight="800"
        letterSpacing="1.5"
        fill={BRAND}
      >
        FIELD NOTES
      </text>
      <text
        className="hm-type"
        style={at(0.6, { '--steps': 22 })}
        x={left}
        y={y + 46}
        fontFamily={SERIF}
        fontSize="15"
        fontWeight="700"
        fill={INK}
      >
        How we ship on Fridays
      </text>

      {/* The byline. */}
      <g className="hm-pop" style={at(1.2)}>
        <circle cx={left + 7} cy={y + 62} r="7" fill="#ec4899" />
        <text
          x={left + 7}
          y={y + 64.5}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize="6"
          fontWeight="800"
          fill="white"
        >
          MC
        </text>
        <text x={left + 19} y={y + 65} fontFamily={SANS} fontSize="7.5" fill={MUTED}>
          Maya Chen · 6 min read
        </text>
      </g>

      {/* The header image. */}
      <g className="hm-wipe" style={at(1.6)}>
        <rect x={left} y={y + 76} width={w - 40} height="54" rx="4" fill="#e0f2fe" />
        <circle cx={left + 140} cy={y + 92} r="7" fill="#fbbf24" />
        <path
          d={`M${left} ${y + 130} L${left + 46} ${y + 98} L${left + 80} ${y + 118} L${left + 112} ${y + 94} L${left + 170} ${y + 130} Z`}
          fill="#7dd3fc"
        />
      </g>

      {/* The intro, written line by line. */}
      {INTRO.map((text, i) => (
        <Line key={text} x={left} y={y + 146 + i * 12} d={2.2 + i * 0.55} text={text} />
      ))}

      {/* A numbered heading and the section under it. */}
      <text
        className="hm-type"
        style={at(4.0, { '--steps': 16 })}
        x={left}
        y={y + 192}
        fontFamily={SANS}
        fontSize="10"
        fontWeight="800"
        fill={INK}
      >
        1. Small batches
      </text>
      {SECTION.map((text, i) => (
        <Line key={text} x={left} y={y + 207 + i * 12} d={4.5 + i * 0.55} text={text} />
      ))}
      {/* Where you are writing. */}
      <rect
        className="hm-caret"
        style={at(6.1)}
        x={left + 74}
        y={y + 224}
        width="1.2"
        height="10"
        fill={BRAND}
      />

      {/* The pull quote. */}
      <g className="hm-pop" style={at(6.4)}>
        <rect x={left} y={y + 242} width="3" height="34" fill={BRAND} />
        <text
          x={left + 10}
          y={y + 256}
          fontFamily={SERIF}
          fontSize="10"
          fontStyle="italic"
          fill={INK}
        >
          “Ship small, ship often,
        </text>
        <text
          x={left + 10}
          y={y + 270}
          fontFamily={SERIF}
          fontSize="10"
          fontStyle="italic"
          fill={INK}
        >
          and Friday takes care of itself.”
        </text>
      </g>

      {/* The teammate selects "a habit the whole team trusts" (the selection tint), the rich-text
          toolbar opens over it, and Bold and Highlight set it in bold on yellow. */}
      <rect
        className="hm-pop"
        style={at(7.6)}
        x={left + 19}
        y={y + 162}
        width="130"
        height="11"
        rx="1.5"
        fill="#7dd3fc"
        // fillOpacity, not opacity: the landing animation owns the element's opacity.
        fillOpacity="0.45"
      />
      <g className="hm-pop" style={at(8.6)}>
        <rect
          x={left - 2}
          y={y + 161}
          width="172"
          height="13"
          className="fill-white dark:fill-slate-100"
        />
        <rect x={left + 19} y={y + 162} width="134" height="11" rx="1.5" fill="#fde68a" />
        <text x={left} y={y + 170} fontFamily={SERIF} fontSize="8.5" fill={BODY}>
          just{' '}
          <tspan fontWeight="700" fill={INK}>
            a habit the whole team trusts.
          </tspan>
        </text>
      </g>
      <g className="hm-select" style={at(7.8)}>
        <rect
          x={left + 26}
          y={y + 138}
          width="118"
          height="20"
          rx="5"
          className="fill-slate-900 dark:fill-slate-700"
        />
        {['B', 'I', 'U', 'H', '•', '↗'].map((g, i) => (
          <text
            key={g}
            x={left + 38 + i * 19}
            y={y + 151.5}
            textAnchor="middle"
            fontFamily={SANS}
            fontSize="8.5"
            fontWeight={g === 'B' ? 800 : 600}
            fontStyle={g === 'I' ? 'italic' : undefined}
            textDecoration={g === 'U' ? 'underline' : undefined}
            fill={g === 'B' ? '#7dd3fc' : 'white'}
          >
            {g}
          </text>
        ))}
      </g>
      <g className="hm-cursor" style={at(7.1, CURSOR(left, y))} aria-hidden>
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

// The teammate's cursor comes in from the right and stops at the end of the selected phrase.
const CURSOR = (left: number, y: number) => ({
  '--sx': `${left + 260}px`,
  '--sy': `${y + 230}px`,
  '--cx': `${left + 146}px`,
  '--cy': `${y + 172}px`,
});
