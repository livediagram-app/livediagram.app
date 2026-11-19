// Games to play together (docs/specs/009-elements/social-pieces.md): the Arcade Machine's Moon Mail panel and its High
// Scores as the editor draws them (apps/editor/components/canvas/collab/arcade/), its screen in the game's own paint.
// The motion is the shared card keyframes (app/feature-art/canvas.css), which settle under reduced motion.

import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { PANEL, RULE, STRONG, SUBTLE, Close } from './space-panel-parts';
import { at } from './space-shot';

// Moon Mail's paint (apps/editor/lib/arcade/moon-mail-paint.ts) and its screen's proportions (moon-mail.ts MOON_R,
// ORBITS), in the card's units.
const MOON = {
  sky: '#060a1c',
  skyInner: '#18214f',
  orbit: 'rgba(148, 163, 184, 0.38)',
  orbitHere: 'rgba(253, 230, 138, 0.42)',
  moonLight: '#e2e8f0',
  moonDark: '#64748b',
  crater: 'rgba(71, 85, 105, 0.5)',
  envelope: '#f8fafc',
  envelopeEdge: '#94a3b8',
  seal: '#ef4444',
  rock: '#8a7f76',
  rockEdge: '#4b423c',
  ship: '#fb7185',
  shipFin: '#e11d48',
  flame: '#fbbf24',
};
const SCREEN = 60;
const MOON_R = 0.11 * SCREEN;
const ORBITS = [0.2, 0.3, 0.4].map((r) => r * SCREEN);

/** A point on an orbit round the screen's middle, `deg` clockwise from the right. */
const onOrbit = (r: number, deg: number) => ({
  x: SCREEN / 2 + Math.cos((deg * Math.PI) / 180) * r,
  y: SCREEN / 2 + Math.sin((deg * Math.PI) / 180) * r,
});

function Envelope({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x - 2.6}
        y={y - 1.8}
        width={5.2}
        height={3.6}
        rx={0.5}
        fill={MOON.envelope}
        stroke={MOON.envelopeEdge}
        strokeWidth={0.4}
      />
      <path
        d={`M${x - 2.6} ${y - 1.8} L${x} ${y + 0.2} L${x + 2.6} ${y - 1.8}`}
        fill="none"
        stroke={MOON.envelopeEdge}
        strokeWidth={0.4}
      />
      <circle cx={x} cy={y + 0.2} r={0.7} fill={MOON.seal} />
    </g>
  );
}

function Rock({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 2.4} ${y - 0.6} L${x - 1} ${y - 2.3} L${x + 1.6} ${y - 1.8} L${x + 2.5} ${y + 0.4} L${x + 0.8} ${y + 2.2} L${x - 1.8} ${y + 1.7} Z`}
      fill={MOON.rock}
      stroke={MOON.rockEdge}
      strokeWidth={0.5}
    />
  );
}

/** Moon Mail's square screen: the stars, the moon, its three dotted orbits, letters, rocks and the mail ship. */
function MoonMailScreen() {
  const ship = onOrbit(ORBITS[1]!, -38);
  const stars = [
    [6, 8],
    [50, 6],
    [54, 44],
    [9, 52],
    [41, 55],
    [27, 4],
  ];
  return (
    <g>
      <defs>
        <radialGradient id="fa-moon-sky">
          <stop offset="0" stopColor={MOON.skyInner} />
          <stop offset="1" stopColor={MOON.sky} />
        </radialGradient>
        <radialGradient id="fa-moon-face" cx="0.42" cy="0.4">
          <stop offset="0" stopColor={MOON.moonLight} />
          <stop offset="1" stopColor={MOON.moonDark} />
        </radialGradient>
      </defs>
      <rect width={SCREEN} height={SCREEN} rx={4} fill="url(#fa-moon-sky)" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={0.45} fill="#fff" opacity={0.8} />
      ))}
      {ORBITS.map((r, i) => (
        <circle
          key={r}
          cx={SCREEN / 2}
          cy={SCREEN / 2}
          r={r}
          fill="none"
          stroke={i === 1 ? MOON.orbitHere : MOON.orbit}
          strokeWidth={0.6}
          strokeDasharray="1 1.6"
        />
      ))}
      <circle cx={SCREEN / 2} cy={SCREEN / 2} r={MOON_R} fill="url(#fa-moon-face)" />
      <circle cx={SCREEN / 2 - 2} cy={SCREEN / 2 - 1.2} r={1.3} fill={MOON.crater} />
      <circle cx={SCREEN / 2 + 2.2} cy={SCREEN / 2 + 2} r={0.9} fill={MOON.crater} />
      <g className="fa-a-pop" style={at(0.5)}>
        <Envelope {...onOrbit(ORBITS[1]!, 20)} />
      </g>
      <g className="fa-a-pop" style={at(0.8)}>
        <Envelope {...onOrbit(ORBITS[2]!, 140)} />
      </g>
      <Envelope {...onOrbit(ORBITS[0]!, 215)} />
      <g className="fa-a-pop" style={at(1.1)}>
        <Rock {...onOrbit(ORBITS[2]!, 60)} />
      </g>
      <Rock {...onOrbit(ORBITS[0]!, 100)} />
      {/* The mail ship flying clockwise round the middle orbit, its flame behind it. */}
      <g transform={`translate(${ship.x} ${ship.y}) rotate(52)`}>
        <path d="M-1 4.6 L0 7.2 L1 4.6 Z" fill={MOON.flame} />
        <path d="M0 -4.2 L2.2 2.6 L0 4.6 L-2.2 2.6 Z" fill={MOON.ship} />
        <path d="M-2.2 2.6 L-3 4.6 L-1 3.6 Z M2.2 2.6 L3 4.6 L1 3.6 Z" fill={MOON.shipFin} />
        <circle cx={0} cy={-0.6} r={0.9} fill="#e0f2fe" />
      </g>
    </g>
  );
}

/** A shield mark in the strip: the lucide shield-check, lit while it is left. */
function Shield({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <path
      d={`M${x} ${y - 3} L${x + 2.6} ${y - 2} V${y + 0.2} C${x + 2.6} ${y + 1.9} ${x + 1.4} ${y + 2.8} ${x} ${y + 3.4} C${x - 1.4} ${y + 2.8} ${x - 2.6} ${y + 1.9} ${x - 2.6} ${y + 0.2} V${y - 2} Z`}
      fill="none"
      strokeWidth={0.8}
      strokeLinejoin="round"
      className={
        on ? 'stroke-sky-600 dark:stroke-sky-300' : 'stroke-slate-300 dark:stroke-slate-600'
      }
    />
  );
}

// The High Scores a Space's machine keeps (HighScores.tsx): best first, rank, name, You on your own, the score in
// grouped figures and the day it was set. Scores a few minutes' run can make: ten points a letter times the streak.
const SCORES = [
  { name: 'Priya', score: '1,860', day: '17 Nov' },
  { name: 'Sam', score: '1,420', day: '18 Nov' },
  { name: 'Leo', score: '1,150', day: '19 Nov', you: true },
  { name: 'Ana', score: '790', day: '12 Nov' },
  { name: 'Maya', score: '430', day: '14 Nov' },
];

/**
 * Games to play together: the Arcade Machine's Moon Mail panel, its screen mid-run with the strip under it, and the
 * machine's High Scores beside it, the run just posted lit.
 */
export function GamesArt() {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        <rect x={20} y={4} width={260} height={88} rx={6} strokeWidth={0.8} className={PANEL} />
        <text x={30} y={15} fontSize={7} fontWeight={700} className={STRONG}>
          Moon Mail
        </text>
        <Close x={270} y={12.5} />
        <path d="M20 20 H280" strokeWidth={0.8} className={RULE} />
        <g transform="translate(30 23)">
          <MoonMailScreen />
        </g>
        {/* The strip: the score, the streak and the shields left. */}
        <text
          x={30}
          y={89.5}
          fontSize={4.4}
          fontWeight={600}
          letterSpacing={0.3}
          className={SUBTLE}
        >
          SCORE
        </text>
        <text x={47} y={89.6} fontSize={6.2} fontWeight={700} className={STRONG}>
          1,150
        </text>
        <rect
          x={64.2}
          y={84.4}
          width={8.6}
          height={6.4}
          rx={3.2}
          className="fill-amber-100 dark:fill-amber-400/15"
        />
        <text
          x={68.5}
          y={89.2}
          fontSize={4.6}
          fontWeight={700}
          textAnchor="middle"
          className="fill-amber-800 dark:fill-amber-200"
        >
          ×3
        </text>
        {/* The shields sit at the strip's far end (ml-auto), under the screen's right edge. */}
        <Shield x={76.8} y={87.4} on />
        <Shield x={82} y={87.4} on />
        <Shield x={87.2} y={87.4} on={false} />
        {/* High Scores. */}
        <text x={104} y={29} fontSize={4.8} fontWeight={600} letterSpacing={0.4} className={SUBTLE}>
          HIGH SCORES
        </text>
        {SCORES.map((s, i) => {
          const y = 32 + i * 11.4;
          return (
            <g key={s.name} className="fa-a-in" style={at(0.2 + i * 0.12)}>
              {s.you ? (
                <rect
                  x={102}
                  y={y}
                  width={170}
                  height={10.4}
                  rx={2.5}
                  strokeWidth={0.6}
                  className="fill-amber-50 stroke-amber-200 dark:fill-amber-400/10 dark:stroke-amber-400/30"
                />
              ) : i % 2 === 1 ? (
                <rect
                  x={102}
                  y={y}
                  width={170}
                  height={10.4}
                  rx={2.5}
                  className="fill-slate-50 dark:fill-slate-800/40"
                />
              ) : null}
              <text
                x={112}
                y={y + 7}
                fontSize={5.4}
                fontWeight={700}
                textAnchor="end"
                className={i === 0 ? 'fill-amber-700 dark:fill-amber-300' : SUBTLE}
              >
                {i + 1}
              </text>
              <text x={117} y={y + 7.1} fontSize={6} fontWeight={500} className={STRONG}>
                {s.name}
              </text>
              {s.you ? (
                <g>
                  <rect
                    x={133}
                    y={y + 2.2}
                    width={13}
                    height={6.2}
                    rx={3.1}
                    className="fill-sky-100 dark:fill-sky-400/15"
                  />
                  <text
                    x={139.5}
                    y={y + 6.7}
                    fontSize={4.6}
                    fontWeight={700}
                    textAnchor="middle"
                    className="fill-sky-800 dark:fill-sky-200"
                  >
                    You
                  </text>
                </g>
              ) : null}
              <text
                x={244}
                y={y + 7.1}
                fontSize={6}
                fontWeight={700}
                textAnchor="end"
                className={STRONG}
              >
                {s.score}
              </text>
              <text x={268} y={y + 7} fontSize={5.2} textAnchor="end" className={SUBTLE}>
                {s.day}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}
