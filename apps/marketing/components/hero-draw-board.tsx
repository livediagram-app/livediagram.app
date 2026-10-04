import type { CSSProperties } from 'react';

// The hero's Draw window (docs/specs/019-marketing/marketing-site.md "Hero"): a retro whiteboard
// drawn in Draw mode's marks, freehand strokes, sticky notes, the highlighter and text
// (docs/specs/023-draw-mode/draw-mode.md). A title is underlined in marker, three stickies land,
// a teammate's blue marker rings the best one and draws an arrow to a star, the highlighter swipes
// a line, and a smiley is doodled in the corner. Each mark arrives at its own --d delay
// (hero-mode-animations.css); strokes draw on by their dash, so they read as drawn by hand.

const NOTE_TEXT = 'fill-[#1c1917]';
const FONT = 'ui-sans-serif, system-ui, sans-serif';
// Draw mode's markers: Marker 1 black, Marker 2 blue, Marker 3 red (the dock's three).
const BLUE = '#2563eb';
const RED = '#dc2626';
const INK = 'stroke-(--art-text)';

type Sticky = { x: number; y: number; tilt: number; fill: string; lines: string[]; d: number };

const STICKIES: Sticky[] = [
  { x: 40, y: 40, tilt: -3, fill: '#fde68a', lines: ['Shipped the', 'beta on time'], d: 0.9 },
  { x: 190, y: 52, tilt: 2, fill: '#fbcfe8', lines: ['Pairing on', 'the hard bits'], d: 1.3 },
  { x: 340, y: 38, tilt: -1.5, fill: '#bbf7d0', lines: ['Fewer, better', 'meetings'], d: 1.7 },
];

function StickyNote({ x, y, tilt, fill, lines, d }: Sticky) {
  return (
    <g className="hm-pop" style={{ '--d': `${d}s` } as CSSProperties}>
      <g transform={`rotate(${tilt} ${x + 55} ${y + 50})`}>
        <rect x={x + 2} y={y + 4} width="110" height="100" rx="3" fill="#0f172a" opacity="0.08" />
        <rect x={x} y={y} width="110" height="100" rx="3" fill={fill} />
        {lines.map((line, i) => (
          <text
            key={line}
            className={NOTE_TEXT}
            x={x + 12}
            y={y + 36 + i * 20}
            fontFamily={FONT}
            fontSize="14"
            fontWeight="600"
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

// A stroke that draws on over `dur` seconds after `d`.
function Stroke({
  d: path,
  at,
  dur,
  len,
  className = '',
  stroke,
  width = 3,
}: {
  d: string;
  at: number;
  dur: number;
  len: number;
  className?: string;
  stroke?: string;
  width?: number;
}) {
  return (
    <path
      className={`hm-draw ${className}`}
      d={path}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ '--d': `${at}s`, '--dur': `${dur}s`, '--len': len } as CSSProperties}
    />
  );
}

// The ring the teammate draws, the glide to the arrow, and the arrow: the pen rides all three.
const RING = 'M246 34 C 320 30, 324 168, 246 172 C 168 176, 166 40, 236 38';
const RING_LEN = 440;
const ARROW = {
  landscape: { d: 'M262 176 C 270 210, 300 232, 340 236', len: 120 },
  portrait: { d: 'M262 176 C 268 240, 290 300, 300 330', len: 165 },
};
const GLIDE_LEN = 140;

// On a phone the board is drawn in a portrait box: the third sticky drops below the first two, the
// arrow runs down to a star under them, the title shrinks to the width, and the smiley moves down.
export function DrawBoard({ portrait = false }: { portrait?: boolean }) {
  const arrow = portrait ? ARROW.portrait : ARROW.landscape;
  const total = RING_LEN + GLIDE_LEN + arrow.len;
  const pen = {
    offsetPath: `path('${RING} L262 176 ${arrow.d.replace(/^M[^C]+/, '')}')`,
    '--p1': `${((RING_LEN / total) * 100).toFixed(1)}%`,
    '--p2': `${(((RING_LEN + GLIDE_LEN) / total) * 100).toFixed(1)}%`,
  } as CSSProperties;
  return (
    <>
      {/* The title, typed with the Text tool, then underlined in marker. */}
      <g transform={portrait ? 'translate(-22 -4) scale(0.86)' : undefined}>
        <text
          className="hm-pop fill-(--art-text)"
          style={{ '--d': '0.2s' } as CSSProperties}
          x="40"
          y="-14"
          fontFamily={FONT}
          fontSize="24"
          fontWeight="700"
        >
          Sprint retro: what went well?
        </text>
        <Stroke
          className={INK}
          d="M40 0 C 110 6, 190 -4, 260 2 S 350 -2, 372 4"
          at={0.5}
          dur={0.6}
          len={360}
        />
      </g>

      {STICKIES.map((s, i) => (
        <g key={s.x} transform={portrait && i === 2 ? 'translate(-235 128)' : undefined}>
          <StickyNote {...s} />
        </g>
      ))}

      {/* The highlighter swipes the pairing note's first line. */}
      <Stroke
        d="M200 84 L292 90"
        stroke="#facc15"
        width={14}
        at={2.6}
        dur={0.5}
        len={100}
        className="hm-highlight"
      />

      {/* The teammate's blue marker rings the best note... */}
      <Stroke d={RING} stroke={BLUE} at={3.4} dur={1.2} len={440} />
      {/* ...then draws an arrow down to a star. */}
      <Stroke d={arrow.d} stroke={BLUE} at={4.8} dur={0.6} len={arrow.len} />
      <Stroke
        d={portrait ? 'M291 320 L300 332 L309 320' : 'M328 226 L341 236 L327 245'}
        stroke={BLUE}
        at={5.3}
        dur={0.25}
        len={36}
      />
      <g transform={portrait ? 'translate(-92 122)' : undefined}>
        <Stroke
          d="M392 210 L400 230 L422 232 L405 245 L411 267 L392 254 L373 267 L379 245 L362 232 L384 230 Z"
          stroke={RED}
          at={5.7}
          dur={0.9}
          len={200}
        />
      </g>
      <text
        className="hm-pop fill-(--art-text)"
        style={{ '--d': '6.6s' } as CSSProperties}
        x={portrait ? 300 : 432}
        y={portrait ? 404 : 246}
        textAnchor={portrait ? 'middle' : undefined}
        fontFamily={FONT}
        fontSize="14"
        fontWeight="600"
      >
        Keep doing this!
      </text>

      {/* A smiley, doodled in the corner. */}
      <g transform={portrait ? 'translate(-6 118)' : undefined}>
        <Stroke
          className={INK}
          d="M70 240 a 26 26 0 1 0 52 0 a 26 26 0 1 0 -52 0"
          at={7.4}
          dur={0.7}
          len={170}
        />
        <Stroke
          className={INK}
          d="M86 234 l0 2 M106 234 l0 2"
          at={8.1}
          dur={0.2}
          len={6}
          width={4}
        />
        <Stroke className={INK} d="M84 248 Q 96 260 108 248" at={8.3} dur={0.35} len={34} />
      </g>

      {/* The teammate's pen rides the ring as it is drawn. */}
      <g className="hm-pen" style={pen} aria-hidden>
        <g transform="translate(-2 -26)">
          <path d="M2 24 L6 12 L16 2 L22 8 L12 18 Z" fill={BLUE} stroke="white" strokeWidth="1.5" />
          <rect x="14" y="-12" width="22" height="13" rx="3" fill="#ec4899" />
          <text
            x="25"
            y="-2.5"
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="8"
            fontWeight="700"
            fill="white"
          >
            JR
          </text>
        </g>
      </g>
    </>
  );
}
