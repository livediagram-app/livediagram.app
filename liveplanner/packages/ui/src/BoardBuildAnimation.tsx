'use client';

import { useRef } from 'react';
import {
  BuildCursor,
  cursorFadeKeyframes,
  cursorKeyframes,
  ease,
  glideStops,
  r1,
  useLoopPhase,
  type Point,
} from '@liveworkspace/ui/build-animation-kit';

// Decorative "someone is moving work along a board" loop, liveplanner's loader: a three-column board (To do, Doing,
// Done) whose cards settle in, then the "You" cursor picks a card up from To do and carries it to Doing while the
// cards below close the gap, moves the Doing card on to Done where it gets its tick, and adds a fresh card to To do,
// the column counts keeping up; then the cards dissolve and the loop restarts. It echoes the editor's core gesture
// (drag a card between columns). Shown by the opening screen (ProjectLoading, docs/specs/007-editor/new-project-route.md).
// A bare illustration with no surface of its own, so each host composes it into its own card or screen.
//
// Pure SVG + CSS keyframes generated once at module load (no JS tick, no deps, runs in the static export). Every
// element shares one timeline (a percentage of the same loop) so the board stays in sync. The base styles show the
// board at rest with no cursor, so prefers-reduced-motion gets a complete, still picture; the loop only runs when
// motion is allowed.

const DURATION_MS = 7000;

// Board geometry, in viewBox units.
const COL_W = 90;
const COL_GAP = 6;
const COL_Y = 8;
const COL_H = 166;
const colX = (c: number) => 9 + c * (COL_W + COL_GAP);
const CARD_W = 78;
const CARD_H = 28;
const SLOTS = [34, 68, 102, 136];
const STEP_X = COL_W + COL_GAP;
const STEP_Y = SLOTS[1]! - SLOTS[0]!;

const COLUMNS = [
  { title: 30, color: '#94a3b8' },
  { title: 26, color: '#8b5cf6' },
  { title: 22, color: '#10b981' },
];

// Each column's count as the cards move: [digit, windows (% of the loop) it shows in].
const COUNTS: [string, [number, number][]][][] = [
  [
    [
      '3',
      [
        [0, 12],
        [67, 100],
      ],
    ],
    ['2', [[12, 67]]],
  ],
  [
    [
      '1',
      [
        [0, 26],
        [40, 100],
      ],
    ],
    ['2', [[26, 40]]],
  ],
  [
    [
      '1',
      [
        [0, 54],
        [97, 100],
      ],
    ],
    ['2', [[54, 97]]],
  ],
];

type Card = { id: string; col: number; slot: number; color: string; title: number };
const CARDS: Card[] = [
  { id: 'a', col: 0, slot: 0, color: '#8b5cf6', title: 46 },
  { id: 'b', col: 0, slot: 1, color: '#0ea5e9', title: 38 },
  { id: 'c', col: 0, slot: 2, color: '#f59e0b', title: 50 },
  { id: 'd', col: 1, slot: 0, color: '#10b981', title: 42 },
  { id: 'e', col: 2, slot: 0, color: '#ec4899', title: 36 },
];
// The card the cursor adds to To do, in the slot C leaves free.
const NEW_CARD: Card = { id: 'f', col: 0, slot: 2, color: '#6366f1', title: 44 };
const cardX = (c: Card) => colX(c.col) + 6;
const cardY = (c: Card) => SLOTS[c.slot]!;

// The "+ Add card" button under To do, and the moment it is pressed.
const ADD = { x: colX(0) + 6, y: SLOTS[3]! + 4, w: CARD_W, h: 20 };
const PRESS = 64;
const NEW_AT = 66;
const HOLD = 92;
const OUT = 97;

// A card's offset from its own spot and how lifted it is (0 resting, 1 held), over the loop.
type Pose = [x: number, y: number, lift: number];
function poseStops(moves: [number, number, Pose][]): [number, Pose][] {
  const stops: [number, Pose][] = [[0, [0, 0, 0]]];
  let at: Pose = [0, 0, 0];
  for (const [t0, t1, to] of moves) {
    const from = at;
    for (let i = 0; i <= 8; i++) {
      const e = ease(i / 8);
      stops.push([t0 + (t1 - t0) * (i / 8), from.map((v, k) => v + (to[k]! - v) * e) as Pose]);
    }
    at = to;
  }
  stops.push([100, at]);
  return stops;
}

const MOVES: Record<string, [number, number, Pose][]> = {
  // A: picked up, carried to Doing's second slot, set down, then up a slot when D leaves.
  a: [
    [8, 10, [0, 0, 1]],
    [10, 26, [STEP_X, STEP_Y, 1]],
    [26, 28, [STEP_X, STEP_Y, 0]],
    [44, 50, [STEP_X, 0, 0]],
  ],
  b: [[14, 20, [0, -STEP_Y, 0]]],
  c: [[16, 22, [0, -STEP_Y, 0]]],
  // D: carried on to Done.
  d: [
    [38, 40, [0, 0, 1]],
    [40, 54, [STEP_X, STEP_Y, 1]],
    [54, 56, [STEP_X, STEP_Y, 0]],
  ],
};

const poseFrames = (name: string, stops: [number, Pose][]) =>
  `@keyframes ${name} {\n${stops
    .map(
      ([t, [x, y, l]]) =>
        `  ${r1(t)}% { transform: translate(${r1(x)}px, ${r1(y)}px) rotate(${r1(-3 * l)}deg) scale(${1 + 0.05 * l}); }`,
    )
    .join('\n')}\n}`;

// Where the pointer's tip rests on a card it holds: in its lower-right half, clear of the title.
const grip = (c: Card, [dx, dy]: Point = [0, 0]): Point => [
  cardX(c) + CARD_W * 0.62 + dx,
  cardY(c) + CARD_H * 0.62 + dy,
];

function cursorStops(): [number, Point][] {
  const stops: [number, Point][] = [];
  const [a, , , d] = CARDS as [Card, Card, Card, Card];
  const rest: Point = [252, 166];
  const addAt: Point = [ADD.x + ADD.w * 0.55, ADD.y + ADD.h * 0.6];
  glideStops(stops, 0, 7, [150, 196], grip(a));
  glideStops(stops, 10, 26, grip(a), grip(a, [STEP_X, STEP_Y]));
  glideStops(stops, 29, 37, grip(a, [STEP_X, STEP_Y]), grip(d));
  glideStops(stops, 40, 54, grip(d), grip(d, [STEP_X, STEP_Y]));
  glideStops(stops, 56, PRESS - 1, grip(d, [STEP_X, STEP_Y]), addAt);
  glideStops(stops, 70, 80, addAt, rest);
  stops.push([100, rest]);
  return stops;
}

// A card fading in as the board settles (staggered), and out with the dissolve.
const fadeFrames = (id: string, at: number) => `@keyframes lbb-${id}-fade {
  0%, ${r1(at)}% { opacity: 0; }
  ${r1(at + 5)}%, ${HOLD}% { opacity: 1; }
  ${OUT}%, 100% { opacity: 0; }
}`;

// Where a carried card will land: a dashed slot that shows while it is on its way.
const TARGETS = [
  { id: 'ta', col: 1, slot: 1, color: '#8b5cf6', show: [12, 26] },
  { id: 'td', col: 2, slot: 1, color: '#10b981', show: [42, 54] },
] as const;
const targetFrames = (id: string, [t0, t1]: readonly [number, number]) => `@keyframes lbb-${id} {
  0%, ${t0}% { opacity: 0; }
  ${t0 + 3}%, ${t1 - 1}% { opacity: 1; }
  ${t1 + 1}%, 100% { opacity: 0; }
}`;

// A dashed ring flashing round a card the moment it is set down.
const ringFrames = (id: string, at: number) => `@keyframes lbb-${id}-ring {
  0%, ${at}% { opacity: 0; }
  ${at + 2}%, ${at + 7}% { opacity: 1; }
  ${at + 11}%, 100% { opacity: 0; }
}`;

// A digit showing only in its windows, crossfading at each edge.
const countFrames = (name: string, windows: [number, number][]) => {
  const stops: string[] = [];
  for (const [t0, t1] of windows) {
    stops.push(
      `  ${Math.max(0, t0 - 0.01)}% { opacity: 0; }`,
      `  ${t0 === 0 ? 0 : t0 + 1}% { opacity: 1; }`,
      `  ${t1 === 100 ? 100 : t1}% { opacity: 1; }`,
    );
    if (t1 !== 100) stops.push(`  ${t1 + 1}% { opacity: 0; }`);
  }
  return `@keyframes ${name} {\n  0% { opacity: 0; }\n${stops.join('\n')}\n  100% { opacity: ${windows.some(([, t1]) => t1 === 100) ? 1 : 0}; }\n}`;
};

const anim = (name: string, timing = 'linear') =>
  `animation: ${name} ${DURATION_MS}ms ${timing} var(--lbb-delay, 0ms) infinite;`;

const ALL_CARDS = [...CARDS, NEW_CARD];

const CSS = `
.lbb-move, .lbb-pop, .lbb-tick, .lbb-add { transform-box: fill-box; transform-origin: center; }
.lbb-type { transform-box: fill-box; transform-origin: left center; }
.lbb-ring, .lbb-tick, .lbb-cursor, .lbb-later, .lbb-target { opacity: 0; }
.lbb-f-fade { opacity: 0; }
.lbb-card { filter: drop-shadow(0 4px 8px rgb(15 23 42 / 0.08)) drop-shadow(0 1px 2px rgb(15 23 42 / 0.08)); }
.dark .lbb-card { filter: drop-shadow(0 6px 12px rgb(0 0 0 / 0.45)); }
@media (prefers-reduced-motion: no-preference) {
${ALL_CARDS.map((c) => `  .lbb-${c.id}-fade { ${anim(`lbb-${c.id}-fade`)} }`).join('\n')}
${Object.keys(MOVES)
  .map((id) => `  .lbb-${id}-move { ${anim(`lbb-${id}-move`)} }`)
  .join('\n')}
${TARGETS.map((t) => `  .lbb-${t.id} { ${anim(`lbb-${t.id}`)} }`).join('\n')}
${TARGETS.map((t) => targetFrames(t.id, t.show)).join('\n')}
  .lbb-a-ring { ${anim('lbb-a-ring')} }
  .lbb-d-ring { ${anim('lbb-d-ring')} }
  .lbb-f-pop { ${anim('lbb-f-pop', 'ease-out')} }
  .lbb-f-type { ${anim('lbb-f-type', 'ease-out')} }
  .lbb-tick { ${anim('lbb-tick', 'ease-out')} }
  .lbb-add { ${anim('lbb-add', 'ease-out')} }
${COUNTS.flatMap((col, c) => col.map((_, k) => `  .lbb-count-${c}-${k} { ${anim(`lbb-count-${c}-${k}`)} }`)).join('\n')}
  .lbb-cursor-move { ${anim('lbb-cursor-move')} }
  .lbb-cursor { ${anim('lbb-cursor-fade')} }
${CARDS.map((c, i) => fadeFrames(c.id, i * 1.6)).join('\n')}
@keyframes lbb-f-fade {
  0%, ${NEW_AT}% { opacity: 0; }
  ${NEW_AT + 3}%, ${HOLD}% { opacity: 1; }
  ${OUT}%, 100% { opacity: 0; }
}
@keyframes lbb-f-pop {
  0%, ${NEW_AT}% { transform: scale(0.6); }
  ${NEW_AT + 4}% { transform: scale(1.06); }
  ${NEW_AT + 7}%, 100% { transform: scale(1); }
}
@keyframes lbb-f-type {
  0%, ${NEW_AT + 4}% { transform: scaleX(0); }
  ${NEW_AT + 12}%, 100% { transform: scaleX(1); }
}
@keyframes lbb-tick {
  0%, 55% { opacity: 0; transform: scale(0.4); }
  59% { opacity: 1; transform: scale(1.2); }
  62%, ${HOLD}% { opacity: 1; transform: scale(1); }
  ${OUT}%, 100% { opacity: 0; transform: scale(1); }
}
@keyframes lbb-add {
  0%, ${PRESS - 1}% { transform: scale(1); }
  ${PRESS + 0.5}% { transform: scale(0.94); }
  ${PRESS + 2.5}%, 100% { transform: scale(1); }
}
${Object.entries(MOVES)
  .map(([id, moves]) => poseFrames(`lbb-${id}-move`, poseStops(moves)))
  .join('\n')}
${ringFrames('a', 26)}
${ringFrames('d', 54)}
${COUNTS.flatMap((col, c) => col.map(([, windows], k) => countFrames(`lbb-count-${c}-${k}`, windows))).join('\n')}
${cursorFadeKeyframes('lbb-cursor-fade')}
${cursorKeyframes('lbb-cursor-move', cursorStops())}
}`;

function CardFace({ card }: { card: Card }) {
  const x = cardX(card);
  const y = cardY(card);
  return (
    <>
      <rect
        x={x}
        y={y}
        width={CARD_W}
        height={CARD_H}
        rx={7}
        className="lbb-card fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        strokeWidth={1}
      />
      <rect x={x} y={y + 7} width={2.5} height={CARD_H - 14} rx={1.25} fill={card.color} />
      <rect
        className={`${card.id === 'f' ? 'lbb-type lbb-f-type ' : ''}fill-slate-300 dark:fill-slate-500`}
        x={x + 9}
        y={y + 7}
        width={card.title}
        height={4}
        rx={2}
      />
      <rect
        x={x + 9}
        y={y + 17}
        width={18}
        height={4.5}
        rx={2.25}
        fill={card.color}
        fillOpacity={0.25}
      />
      <circle cx={x + CARD_W - 11} cy={y + 19} r={4.5} fill={card.color} fillOpacity={0.85} />
    </>
  );
}

export function BoardBuildAnimation({
  className = 'max-w-[240px]',
  cursorLabel,
  label = 'Moving cards along a board',
}: {
  className?: string;
  /** Whose cursor moves the cards (default "You"). */
  cursorLabel?: string;
  /** The picture's accessible name; empty, it is decorative and hidden from assistive tech. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The /new creating stage gives way to the editor's own load in place: the board carries on, never restarts.
  useLoopPhase(ref, 'board', DURATION_MS, '--lbb-delay');
  const d = CARDS[3]!;

  return (
    <div ref={ref} className={`mx-auto w-full ${className}`}>
      <svg
        viewBox="0 0 300 180"
        className="w-full overflow-visible"
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      >
        {COLUMNS.map((col, c) => (
          <g key={c}>
            <rect
              x={colX(c)}
              y={COL_Y}
              width={COL_W}
              height={COL_H}
              rx={10}
              className="fill-slate-100/80 stroke-slate-200/80 dark:fill-slate-900/70 dark:stroke-slate-800"
              strokeWidth={1}
            />
            <circle cx={colX(c) + 12} cy={21} r={3.5} fill={col.color} />
            <rect
              x={colX(c) + 20}
              y={18.5}
              width={col.title}
              height={5}
              rx={2.5}
              className="fill-slate-400 dark:fill-slate-500"
            />
            <rect
              x={colX(c) + COL_W - 22}
              y={14.5}
              width={14}
              height={13}
              rx={6.5}
              className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
              strokeWidth={1}
            />
            {COUNTS[c]!.map(([digit], k) => (
              <text
                key={k}
                className={`lbb-count-${c}-${k}${k > 0 ? ' lbb-later' : ''}`}
                x={colX(c) + COL_W - 15}
                y={24}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fill={col.color}
              >
                {digit}
              </text>
            ))}
          </g>
        ))}

        {/* "+ Add card" under To do: pressed as the new card arrives. */}
        <g className="lbb-add">
          <rect
            x={ADD.x}
            y={ADD.y}
            width={ADD.w}
            height={ADD.h}
            rx={6}
            fill="none"
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth={1}
            strokeDasharray="3 2.5"
          />
          <path
            d={`M ${ADD.x + 30} ${ADD.y + 10} h 7 M ${ADD.x + 33.5} ${ADD.y + 6.5} v 7`}
            className="stroke-slate-400 dark:stroke-slate-500"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <rect
            x={ADD.x + 41}
            y={ADD.y + 8}
            width={16}
            height={4}
            rx={2}
            className="fill-slate-300 dark:fill-slate-600"
          />
        </g>

        {TARGETS.map((t) => (
          <rect
            key={t.id}
            className={`lbb-target lbb-${t.id}`}
            x={colX(t.col) + 6}
            y={SLOTS[t.slot]}
            width={CARD_W}
            height={CARD_H}
            rx={7}
            fill={t.color}
            fillOpacity={0.08}
            stroke={t.color}
            strokeOpacity={0.5}
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        ))}

        {ALL_CARDS.map((card) => (
          <g key={card.id} className={`lbb-${card.id}-fade`}>
            <g className={card.id === 'f' ? 'lbb-pop lbb-f-pop' : `lbb-move lbb-${card.id}-move`}>
              {(card.id === 'a' || card.id === 'd') && (
                <rect
                  className={`lbb-ring lbb-${card.id}-ring`}
                  x={cardX(card) - 3.5}
                  y={cardY(card) - 3.5}
                  width={CARD_W + 7}
                  height={CARD_H + 7}
                  rx={9.5}
                  fill="none"
                  stroke={card.color}
                  strokeOpacity={0.6}
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                />
              )}
              <CardFace card={card} />
              {card.id === 'd' && (
                // Done: D's tick.
                <g className="lbb-tick">
                  <circle
                    cx={cardX(d) + CARD_W - 2}
                    cy={cardY(d) + 2}
                    r={6.5}
                    fill="#10b981"
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  <path
                    d={`M ${cardX(d) + CARD_W - 5} ${cardY(d) + 2.2} l 2 2 l 3.6 -3.8`}
                    fill="none"
                    stroke="white"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </g>
          </g>
        ))}

        <BuildCursor moveClass="lbb-cursor-move" fadeClass="lbb-cursor" label={cursorLabel} />
      </svg>
      <style>{CSS}</style>
    </div>
  );
}
