// Feature illustrations for the canvas elements that carry more than a label: the sequence
// diagram (docs/specs/009-elements/sequence-diagram.md), charts and meters (the palette's Data
// elements) and code blocks. Diagram ink is the Default theme's, read through the canvas-marks
// utilities; a code block paints from its own scheme (Midnight, packages/document/src/code-themes.ts).

import { ARROW, Caret, INK, INK_TEXT, SHADOW, Scene, TEXT_BODY } from './canvas-marks';
import { AMBER, EMERALD, Frame, MONO, SKY, VIOLET } from './shared';

// Sequence diagram: three participants over dashed lifelines, the messages top to bottom (a call,
// a call on to the database, its dashed reply, a reply back), an activation bar on the API while it
// works, each message numbered, the newest drawn in as it is typed.
export function SequenceArt() {
  const cols = [
    { x: 58, name: 'Customer', actor: true },
    { x: 150, name: 'API' },
    { x: 242, name: 'Database' },
  ];
  const messages = [
    { y: 34, from: 58, to: 146, words: '1: Place order', reply: false },
    { y: 50, from: 154, to: 242, words: '2: Save order', reply: false },
    { y: 64, from: 242, to: 154, words: '3: Order id', reply: true },
    { y: 80, from: 146, to: 58, words: '4: Confirmed', reply: true },
  ];
  return (
    <Frame canvas>
      <Scene>
        {cols.map((c) => (
          <g key={c.name}>
            <line
              className={ARROW}
              x1={c.x}
              x2={c.x}
              y1="22"
              y2="92"
              strokeWidth="0.8"
              strokeDasharray="2.5 2"
            />
            {c.actor ? (
              // An actor is a stick figure over its name, not a box.
              <g>
                <g className="stroke-(--art-ink-stroke)" strokeWidth="1" fill="none">
                  <circle cx={c.x} cy="4.6" r="2.4" />
                  <path d={`M${c.x} 7 v5 m-3.4 -3 h6.8 m-6.6 7.6 l3.2 -4.6 l3.2 4.6`} />
                </g>
                <text className={INK_TEXT} x={c.x + 7} y="13" fontSize="6" fontWeight="700">
                  {c.name}
                </text>
              </g>
            ) : (
              <g>
                <rect
                  className={INK}
                  x={c.x - 22}
                  y="6"
                  width="44"
                  height="15"
                  rx="2"
                  strokeWidth="1"
                />
                <text
                  className={INK_TEXT}
                  x={c.x}
                  y="15.8"
                  fontSize="6"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {c.name}
                </text>
              </g>
            )}
          </g>
        ))}
        {/* The API's activation bar, from the call it takes to the reply it sends. */}
        <rect className={INK} x="146" y="31" width="8" height="52" rx="1" strokeWidth="0.9" />
        {messages.map((m, i) => {
          const dir = m.to > m.from ? 1 : -1;
          return (
            <g
              key={m.words}
              className={i === messages.length - 1 ? 'fa-d-land' : undefined}
              style={i === messages.length - 1 ? { animationDelay: '0.6s' } : undefined}
            >
              <line
                className={ARROW}
                x1={m.from}
                x2={m.to - dir * 4}
                y1={m.y}
                y2={m.y}
                strokeWidth="1"
                strokeDasharray={m.reply ? '3 2' : undefined}
              />
              {m.reply ? (
                <path
                  className={ARROW}
                  d={`M${m.to - dir * 4} ${m.y - 2.6} L${m.to} ${m.y} L${m.to - dir * 4} ${m.y + 2.6}`}
                  strokeWidth="1"
                  fill="none"
                />
              ) : (
                <path
                  className="fill-(--art-arrow)"
                  d={`M${m.to} ${m.y} l${-dir * 4.6} -2.7 v5.4z`}
                />
              )}
              <text
                className={INK_TEXT}
                x={(m.from + m.to) / 2}
                y={m.y - 2.4}
                fontSize="5.4"
                textAnchor="middle"
              >
                {m.words}
              </text>
            </g>
          );
        })}
      </Scene>
    </Frame>
  );
}

// Charts and meters on the canvas: a column chart, a pie split into slices, a progress ring and a
// star rating, side by side in the theme's colours (the rating keeps its amber), the columns
// growing in.
export function CanvasChartsArt() {
  const bars = [
    { h: 26, c: SKY },
    { h: 40, c: SKY },
    { h: 33, c: SKY },
    { h: 52, c: SKY },
    { h: 46, c: SKY },
  ];
  return (
    <Frame canvas>
      <Scene>
        {/* Column chart. */}
        <line className={ARROW} x1="16" x2="104" y1="80" y2="80" strokeWidth="0.9" />
        <line className={ARROW} x1="16" x2="16" y1="18" y2="80" strokeWidth="0.9" />
        {bars.map((b, i) => (
          <rect
            key={i}
            className="fa-grow"
            style={{ animationDelay: `${i * 0.15}s`, transformOrigin: 'bottom' }}
            x={24 + i * 16}
            y={80 - b.h}
            width="10"
            height={b.h}
            rx="1"
            fill={b.c}
          />
        ))}
        {['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((q, i) => (
          <text
            key={q}
            className={INK_TEXT}
            x={29 + i * 16}
            y="88"
            fontSize="5"
            textAnchor="middle"
          >
            {q}
          </text>
        ))}
        {/* Pie. */}
        <g transform="translate(146 48)">
          <path d="M0 0 L0 -26 A26 26 0 0 1 24.7 8 Z" fill={SKY} />
          <path d="M0 0 L24.7 8 A26 26 0 0 1 -15.3 21 Z" fill={VIOLET} />
          <path d="M0 0 L-15.3 21 A26 26 0 0 1 0 -26 Z" fill={EMERALD} />
          <circle r="26" fill="none" className="stroke-(--art-paper)" strokeWidth="0" />
        </g>
        {/* Progress ring. */}
        <g transform="translate(212 40)">
          <circle r="18" fill="none" className="stroke-(--art-ink-shade)" strokeWidth="5" />
          <circle
            r="18"
            fill="none"
            stroke={SKY}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="81.4 113.1"
            transform="rotate(-90)"
          />
          <text className={INK_TEXT} y="2.4" fontSize="7.4" fontWeight="700" textAnchor="middle">
            72%
          </text>
        </g>
        {/* Rating. */}
        <g transform="translate(244 78)">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              transform={`translate(${i * 10} 0) scale(0.42)`}
              d="M10 0 L12.9 6.3 L19.5 6.9 L14.5 11.3 L16 18 L10 14.5 L4 18 L5.5 11.3 L0.5 6.9 L7.1 6.3 Z"
              fill={i < 4 ? AMBER : 'none'}
              stroke={AMBER}
              strokeWidth="1.6"
            />
          ))}
        </g>
        <text className={TEXT_BODY} x="186" y="76" fontSize="5">
          Launch readiness
        </text>
      </Scene>
    </Frame>
  );
}

// The Midnight scheme's colours, restated for the SVG.
const CODE = {
  surface: '#0f172a',
  border: '#334155',
  text: '#e2e8f0',
  muted: '#64748b',
  keyword: '#93c5fd',
  string: '#86efac',
  number: '#fca5a5',
} as const;

// Code block: a service on the canvas with its query beside it in a Midnight card, the SQL badge
// in the corner and the syntax coloured, a caret at the end of the line being written.
export function CodeBlockArt() {
  const lines: [string, string][][] = [
    [
      ['SELECT ', CODE.keyword],
      ['id, total', CODE.text],
    ],
    [
      ['FROM ', CODE.keyword],
      ['orders', CODE.text],
    ],
    [
      ['WHERE ', CODE.keyword],
      ['status = ', CODE.text],
      ["'paid'", CODE.string],
    ],
    [
      ['LIMIT ', CODE.keyword],
      ['50', CODE.number],
      [';', CODE.text],
    ],
  ];
  return (
    <Frame canvas>
      <Scene>
        <rect className={INK} x="18" y="34" width="62" height="28" rx="3" strokeWidth="1" />
        <text
          className={INK_TEXT}
          x="49"
          y="50.4"
          fontSize="6.6"
          fontWeight="700"
          textAnchor="middle"
        >
          Orders DB
        </text>
        <line className={ARROW} x1="80" x2="110" y1="48" y2="48" strokeWidth="1" />
        <path className="fill-(--art-arrow)" d="M114 48 l-4.6 -2.7 v5.4z" />
        <g className={SHADOW}>
          <rect
            x="116"
            y="12"
            width="164"
            height="72"
            rx="5"
            fill={CODE.surface}
            stroke={CODE.border}
            strokeWidth="0.8"
          />
        </g>
        <rect x="256" y="17" width="18" height="9" rx="2" fill={CODE.border} />
        <text x="265" y="23.4" fontSize="5" fontWeight="700" fill={CODE.text} textAnchor="middle">
          sql
        </text>
        {lines.map((parts, row) => (
          <g key={row}>
            <text
              x="124"
              y={33 + row * 13}
              fontSize="6.2"
              fontFamily={MONO}
              fill={CODE.muted}
              textAnchor="start"
            >
              {row + 1}
            </text>
            <text x="134" y={33 + row * 13} fontSize="6.6" fontFamily={MONO} xmlSpace="preserve">
              {parts.map(([t, c]) => (
                <tspan key={t} fill={c}>
                  {t}
                </tspan>
              ))}
            </text>
          </g>
        ))}
        <Caret x={182} y={66} h={8} />
      </Scene>
    </Frame>
  );
}
