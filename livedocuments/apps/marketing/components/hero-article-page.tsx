import { useId } from 'react';
import { FONT, TEAMMATE, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';
import { PageTwo } from './hero-article-page-two';
import {
  BODY_SIZE,
  BRAND,
  Heading,
  INK,
  LEADING,
  LEFT,
  Line,
  MEASURE,
  MUTED,
  RichTextToolbar,
  Sheet,
} from './hero-article-parts';

// The hero's Article window (docs/specs/019-marketing/marketing-site.md "Hero"): a long read written
// in Pages mode (docs/specs/007-editor/article-pages.md), on two A4 pages, each under the
// editor's label row. On page 1 a kicker and a two-line title are typed, the subtitle and byline
// land, a header image wipes in, the intro is written line by line, then a heading and its bullets.
// The article runs on to page 2: a checklist ticks, a quote sets in behind its rule, a figure's bars
// grow over their caption, and a caret blinks where you are writing. Meanwhile a teammate selects a
// phrase on page 1: the rich-text toolbar docks at the top of the page, Bold is pressed, and the
// phrase turns bold on a highlight. Each piece arrives at its own --d delay
// (hero-scenes/pages.css; the phrase's own handover in hero-scenes/article.css).

// Where each page sits: side by side in the wide window; stacked on a phone, page 2 running on
// below the fold as a phone scrolls.
const PAGES = {
  landscape: [
    { x: 30, y: -46 },
    { x: 310, y: -46 },
  ],
  portrait: [
    { x: 60, y: -24 },
    { x: 60, y: 368 },
  ],
} as const;

const INTRO = [
  'No release trains, no freeze. Fridays are',
  'a habit the whole team trusts.',
  'Ready at four? Then it goes out.',
];
const PHRASE = INTRO[1]!;
const BULLETS = [
  'Small PRs, under 200 lines each',
  'Feature flags: deploying is not releasing',
  'One-click rollback, rehearsed monthly',
];

// The intro's lines, and the phrase the teammate sets bold (line 2).
const INTRO_Y = 244;
const PHRASE_Y = INTRO_Y + LEADING;
// The phrase's width in bold, with a hair to spare for wider system faces.
const PHRASE_W = 147;

export function ArticlePage({ portrait = false }: { portrait?: boolean }) {
  const [one, two] = PAGES[portrait ? 'portrait' : 'landscape'];
  return (
    <>
      <PageOne x={one.x} y={one.y} />
      <PageTwo x={two.x} y={two.y} />
    </>
  );
}

function PageOne({ x, y }: { x: number; y: number }) {
  // Gradient ids unique per window: the hero and a landing beat can draw this scene on one page.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sky = `art-sky-${uid}`;
  const sun = `art-sun-${uid}`;
  const img = { y: 154, h: 68 };
  return (
    <Sheet x={x} y={y} folio={1}>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="0.55" stopColor="#7c3aed" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
        <radialGradient id={sun} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.45" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Kicker, title, subtitle and byline. */}
      <Line y={46} d={0.3} text="FIELD NOTES · ENGINEERING" size={7.5} weight={800} fill={BRAND} />
      <Line y={72} d={0.6} text="How we ship" size={23} weight={800} fill={INK} />
      <Line y={97} d={1.0} text="on Fridays" size={23} weight={800} fill={INK} />
      <g className="hm-fade" style={at(1.4)} fontFamily={FONT} fontSize="9.5" fill={MUTED}>
        <text x={LEFT} y={116}>
          A small weekly ritual that made our
        </text>
        <text x={LEFT} y={129}>
          releases boring, in the best way.
        </text>
      </g>
      <g className="hm-pop" style={at(1.7)}>
        <circle cx={LEFT + 7} cy={142} r="7" fill="#8b5cf6" />
        <text
          x={LEFT + 7}
          y={144.6}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="6.5"
          fontWeight="800"
          fill="white"
        >
          MC
        </text>
        <text x={LEFT + 19} y={145} fontFamily={FONT} fontSize="8" fill={MUTED}>
          <tspan fontWeight="700" fill={INK}>
            Maya Chen
          </tspan>
          {'  ·  Head of Platform  ·  6 min read'}
        </text>
      </g>

      {/* The header image: dusk over the hills, the sun low, a little town's lights below. */}
      <g className="hm-wipe" style={at(2.0)}>
        <rect x={LEFT} y={img.y} width={MEASURE} height={img.h} rx="4" fill={`url(#${sky})`} />
        <circle cx={LEFT + 150} cy={img.y + 50} r="30" fill={`url(#${sun})`} />
        <circle cx={LEFT + 150} cy={img.y + 50} r="9" fill="#fef3c7" />
        <path
          d={`M${LEFT} ${img.y + 50} C ${LEFT + 40} ${img.y + 36}, ${LEFT + 80} ${img.y + 44}, ${LEFT + 120} ${img.y + 52} S ${LEFT + 190} ${img.y + 40}, ${LEFT + MEASURE} ${img.y + 46} V ${img.y + img.h} H ${LEFT} Z`}
          fill="#1d4ed8"
          opacity="0.55"
        />
        <path
          d={`M${LEFT} ${img.y + 60} C ${LEFT + 50} ${img.y + 50}, ${LEFT + 95} ${img.y + 62}, ${LEFT + 140} ${img.y + 57} S ${LEFT + 200} ${img.y + 55}, ${LEFT + MEASURE} ${img.y + 61} V ${img.y + img.h - 4} Q ${LEFT + MEASURE} ${img.y + img.h} ${LEFT + MEASURE - 4} ${img.y + img.h} H ${LEFT + 4} Q ${LEFT} ${img.y + img.h} ${LEFT} ${img.y + img.h - 4} Z`}
          fill="#0c4a6e"
        />
        {[28, 37, 45, 168, 177, 183, 192].map((dx, i) => (
          <rect
            key={dx}
            x={LEFT + dx}
            y={img.y + 62 + (i % 2)}
            width="2"
            height="2"
            rx="0.5"
            fill="#fde68a"
          />
        ))}
      </g>

      {/* The intro, written line by line; its second line is the phrase the teammate sets. */}
      <Line y={INTRO_Y} d={2.6} text={INTRO[0]!} />
      <rect
        className="hm-select"
        style={at(7.4)}
        x={LEFT - 1.5}
        y={PHRASE_Y - 9.5}
        width={PHRASE_W - 4}
        height="13"
        rx="2"
        fill="#7dd3fc"
        fillOpacity="0.5"
      />
      <g className="ha-plain" style={at(8.7)}>
        <Line y={PHRASE_Y} d={3.1} text={PHRASE} />
      </g>
      <g className="hm-fade" style={at(8.7)}>
        <rect x={LEFT - 2} y={PHRASE_Y - 10} width={PHRASE_W} height="14" rx="2.5" fill="#fde68a" />
        <text
          x={LEFT}
          y={PHRASE_Y}
          fontFamily={FONT}
          fontSize={BODY_SIZE}
          fontWeight="700"
          fill={INK}
        >
          {PHRASE}
        </text>
      </g>
      <Line y={INTRO_Y + 2 * LEADING} d={3.6} text={INTRO[2]!} />

      {/* A heading and its bullets. */}
      <Heading y={300} d={4.2}>
        Why it works
      </Heading>
      {BULLETS.map((text, i) => (
        <g key={text}>
          <circle
            className="hm-pop"
            style={at(4.5 + i * 0.35)}
            cx={LEFT + 3}
            cy={314 + i * 15}
            r="1.8"
            fill={BRAND}
          />
          <Line x={LEFT + 11} y={317 + i * 15} d={4.55 + i * 0.35} text={text} />
        </g>
      ))}

      {/* The teammate's selection: the toolbar docks at the top of the page, Bold is pressed. */}
      <RichTextToolbar d={8.0} bold={8.6} />
      <g
        className="hm-cursor"
        style={at(6.6, {
          '--sx': `${LEFT + 260}px`,
          '--sy': `${PHRASE_Y + 80}px`,
          '--cx': `${LEFT + PHRASE_W + 1}px`,
          '--cy': `${PHRASE_Y - 9}px`,
        })}
        aria-hidden
      >
        <CursorMark colour={TEAMMATE} label="JR" />
      </g>
    </Sheet>
  );
}
