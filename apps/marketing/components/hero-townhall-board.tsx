import type { CSSProperties, ReactNode } from 'react';
import { FONT, at } from '@/components/art-tokens';

// The hero's Town Hall window (docs/specs/019-marketing/marketing-site.md "Hero"): the app's Town Hall
// Q&A template (packages/templates template-builders-town-hall.ts) running live. The Q&A board
// (docs/specs/012-collaboration/qa-board.md) leads, one element across most of the canvas: questions
// land, votes tick up, the most-voted rises, is answered, and is marked done. Beside it the
// facilitator's kit, one card each: who is on the panel, the Q&A timer counting down, the room's
// reactions floating up, and a "How useful was this?" poll filling in. A phone stacks the board over
// the kit. Each piece arrives at its own --d delay (hero-mode-animations.css).

const BRAND = '#0ea5e9';
const CARD = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const INSET = 'fill-slate-50 stroke-slate-200 dark:fill-slate-800/70 dark:stroke-slate-700';
const INK = 'fill-slate-800 dark:fill-slate-100';
const MUTED = 'fill-slate-500 dark:fill-slate-400';
const TRACK = 'fill-slate-100 dark:fill-slate-800';

type Person = { initials: string; name: string; colour: string };
const MAYA: Person = { initials: 'MC', name: 'Maya Chen', colour: '#7c3aed' };
const DEV: Person = { initials: 'DP', name: 'Dev Patel', colour: '#0891b2' };
const PRIYA: Person = { initials: 'PN', name: 'Priya Nair', colour: '#db2777' };

type Question = { text: string; who: Person; ago: string; votes: [number, number]; d: number };
// In the order they arrive. The second gathers the most votes and rises to the top.
const QUESTIONS: Question[] = [
  {
    text: 'What is on the Q4 roadmap?',
    who: { initials: 'SL', name: 'Sam Lee', colour: '#f59e0b' },
    ago: '4m',
    votes: [3, 5],
    d: 1.2,
  },
  {
    text: 'Will Fridays stay meeting-free?',
    who: { initials: 'AR', name: 'Alex Rivera', colour: '#10b981' },
    ago: '3m',
    votes: [4, 21],
    d: 1.8,
  },
  {
    text: 'When does the EU launch land?',
    who: { initials: 'JO', name: 'Jo Okafor', colour: '#6366f1' },
    ago: '2m',
    votes: [2, 8],
    d: 2.4,
  },
  {
    text: 'Is the team offsite on this year?',
    who: { initials: 'KW', name: 'Kim Wu', colour: '#ef4444' },
    ago: '1m',
    votes: [1, 6],
    d: 3.0,
  },
];
// The order the questions settle in once the votes are in.
const FINAL_SLOT = [1, 0, 2, 3];
const POLL = [1, 2, 4, 9, 12];

const VOTES_AT = 4.0;
const RISE_AT = 5.2;
const ANSWERING_AT = 6.2;
const ANSWERED_AT = 8.4;

type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  board: Box;
  rowH: number;
  // The board's "Ask a question" box, where the window has the room for it.
  ask: boolean;
  question: number; // a question's font size
  panel?: Box;
  timer: Box;
  reactions: Box;
  poll: Box;
};

// The board takes the canvas's left two thirds, the kit a column on the right, every card on one
// 8-unit grid; a phone stacks the board over the kit.
const LANDSCAPE: Layout = {
  board: { x: 20, y: -36, w: 360, h: 336 },
  rowH: 60,
  ask: true,
  question: 11.5,
  panel: { x: 396, y: -36, w: 184, h: 72 },
  timer: { x: 396, y: 48, w: 184, h: 68 },
  reactions: { x: 396, y: 128, w: 184, h: 68 },
  poll: { x: 396, y: 208, w: 184, h: 92 },
};
const PORTRAIT: Layout = {
  board: { x: 4, y: -24, w: 352, h: 324 },
  rowH: 66,
  ask: false,
  question: 12,
  timer: { x: 4, y: 312, w: 172, h: 72 },
  reactions: { x: 184, y: 312, w: 172, h: 72 },
  poll: { x: 4, y: 396, w: 352, h: 84 },
};

function Txt({
  x,
  y,
  size,
  weight = 400,
  className = INK,
  anchor,
  children,
  ...rest
}: {
  x: number;
  y: number;
  size: number;
  weight?: number;
  className?: string;
  anchor?: 'middle' | 'end';
  children: ReactNode;
  style?: CSSProperties;
  fill?: string;
  letterSpacing?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      fontFamily={FONT}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      className={className}
      {...rest}
    >
      {children}
    </text>
  );
}

// A card of the kit: the editor's element card, a soft shadow under it, and its caps heading.
function KitCard({ box, title, children }: { box: Box; title: string; children?: ReactNode }) {
  return (
    <>
      <rect
        x={box.x}
        y={box.y + 2}
        width={box.w}
        height={box.h}
        rx="10"
        fill="#0f172a"
        opacity="0.05"
      />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" className={CARD} />
      <Txt
        x={box.x + 14}
        y={box.y + 19}
        size={8}
        weight={700}
        className={MUTED}
        letterSpacing={0.8}
      >
        {title}
      </Txt>
      {children}
    </>
  );
}

function Avatar({ cx, cy, r, person }: { cx: number; cy: number; r: number; person: Person }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r + 1.5} className="fill-white dark:fill-slate-900" />
      <circle cx={cx} cy={cy} r={r} fill={person.colour} />
      {/* Baseline half a cap height below the centre (about 0.365 of the font size), so the
          initials' ink sits on the disc's centre (the optical audit holds it to 0.5px). */}
      <Txt
        x={cx}
        y={cy + r * 0.85 * 0.365}
        size={r * 0.85}
        weight={800}
        anchor="middle"
        className=""
        fill="white"
      >
        {person.initials}
      </Txt>
    </>
  );
}

export function TownHallBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  return (
    <>
      <Board L={L} />
      {L.panel ? <Panel box={L.panel} /> : null}
      <Timer box={L.timer} />
      <Reactions box={L.reactions} />
      <Poll box={L.poll} />
    </>
  );
}

// The Q&A board element: its header, the questions as vote rows, and the box the room asks in.
function Board({ L }: { L: Layout }) {
  const box = L.board;
  const right = box.x + box.w;
  const rowY = (i: number) => box.y + 52 + i * L.rowH;
  const h = L.rowH - 8;
  return (
    <>
      <g className="hm-pop" style={at(0.2)}>
        <rect
          x={box.x}
          y={box.y + 3}
          width={box.w}
          height={box.h}
          rx="14"
          fill="#0f172a"
          opacity="0.06"
        />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="14" className={CARD} />
        <Txt x={box.x + 16} y={box.y + 24} size={13} weight={800}>
          Questions for the panel
        </Txt>
        <Txt x={box.x + 16} y={box.y + 38} size={8.5} className={MUTED}>
          Q3 all-hands · 4 questions · sorted by votes
        </Txt>
        <rect
          x={right - 56}
          y={box.y + 13}
          width="42"
          height="16"
          rx="8"
          fill="#ef4444"
          fillOpacity="0.14"
        />
        <circle className="hm-live" cx={right - 46} cy={box.y + 21} r="3" fill="#ef4444" />
        <Txt
          x={right - 39}
          y={box.y + 24}
          size={8}
          weight={800}
          className="fill-red-700 dark:fill-red-300"
        >
          LIVE
        </Txt>
      </g>

      {QUESTIONS.map((q, i) => {
        const y = rowY(i);
        const dy = (FINAL_SLOT[i]! - i) * L.rowH;
        const top = FINAL_SLOT[i] === 0;
        const x = box.x + 12;
        const w = box.w - 24;
        return (
          <g key={q.text} className="hm-move" style={at(RISE_AT, { '--dy': `${dy}px` })}>
            <g className="hm-pop" style={at(q.d)}>
              <rect x={x} y={y} width={w} height={h} rx="10" className={INSET} />
              {/* The vote button: an arrow over the count. */}
              <rect x={x + 8} y={y + 8} width="36" height={h - 16} rx="8" className={CARD} />
              <path
                d={`M${x + 20} ${y + 21} l6 -6 l6 6`}
                fill="none"
                stroke={top ? BRAND : '#94a3b8'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Txt
                className={`hm-out ${INK}`}
                style={at(VOTES_AT + i * 0.2)}
                x={x + 26}
                y={y + h - 14}
                size={11}
                weight={800}
                anchor="middle"
              >
                {q.votes[0]}
              </Txt>
              <Txt
                className={`hm-fade ${top ? '' : INK}`}
                style={at(VOTES_AT + i * 0.2)}
                x={x + 26}
                y={y + h - 14}
                size={11}
                weight={800}
                anchor="middle"
                fill={top ? BRAND : undefined}
              >
                {q.votes[1]}
              </Txt>
              <Txt x={x + 56} y={y + 22} size={L.question} weight={700}>
                {q.text}
              </Txt>
              <Avatar cx={x + 62} cy={y + h - 15} r={6} person={q.who} />
              <Txt x={x + 73} y={y + h - 12} size={8.5} className={MUTED}>
                {q.who.name} · {q.ago} ago
              </Txt>
            </g>
            {top ? (
              <>
                <rect
                  className="hm-fade"
                  style={at(ANSWERING_AT)}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="10"
                  fill="none"
                  stroke={BRAND}
                  strokeWidth="2"
                />
                <g className="hm-select" style={at(ANSWERING_AT)}>
                  <rect
                    x={x + w - 84}
                    y={y + h - 22}
                    width="74"
                    height="15"
                    rx="7.5"
                    fill={BRAND}
                    fillOpacity="0.15"
                  />
                  <Txt
                    x={x + w - 47}
                    y={y + h - 11.5}
                    size={8}
                    weight={700}
                    anchor="middle"
                    className="fill-sky-700 dark:fill-sky-300"
                  >
                    Answering now
                  </Txt>
                </g>
                <g className="hm-pop" style={at(ANSWERED_AT)}>
                  <rect
                    x={x + w - 84}
                    y={y + h - 22}
                    width="74"
                    height="15"
                    rx="7.5"
                    fill="#22c55e"
                    fillOpacity="0.16"
                  />
                  <path
                    d={`M${x + w - 74} ${y + h - 14.5} l2.5 2.5 l4.5 -5`}
                    fill="none"
                    className="stroke-green-700 dark:stroke-green-300"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Txt
                    x={x + w - 41}
                    y={y + h - 11.5}
                    size={8}
                    weight={700}
                    anchor="middle"
                    className="fill-green-700 dark:fill-green-300"
                  >
                    Answered
                  </Txt>
                </g>
              </>
            ) : null}
          </g>
        );
      })}

      {L.ask ? (
        <g className="hm-pop" style={at(0.6)}>
          <rect
            x={box.x + 12}
            y={box.y + box.h - 40}
            width={box.w - 24}
            height="28"
            rx="8"
            className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
            strokeDasharray="4 3"
          />
          <Txt x={box.x + 26} y={box.y + box.h - 23} size={9} className={MUTED}>
            Ask the panel a question…
          </Txt>
          <rect x={right - 70} y={box.y + box.h - 35} width="52" height="18" rx="6" fill={BRAND} />
          <Txt
            x={right - 44}
            y={box.y + box.h - 23}
            size={8.5}
            weight={700}
            anchor="middle"
            className=""
            fill="white"
          >
            Ask
          </Txt>
        </g>
      ) : null}
    </>
  );
}

// On the panel: the host and who is answering with them.
function Panel({ box }: { box: Box }) {
  const people = [MAYA, DEV, PRIYA];
  return (
    <g className="hm-pop" style={at(0.5)}>
      <KitCard box={box} title="ON THE PANEL">
        {people.map((p, i) => (
          <Avatar key={p.initials} cx={box.x + 24 + i * 22} cy={box.y + 47} r={10} person={p} />
        ))}
        <Txt x={box.x + 92} y={box.y + 44} size={10} weight={700}>
          Maya Chen
        </Txt>
        <Txt x={box.x + 92} y={box.y + 57} size={8.5} className={MUTED}>
          with Dev and Priya
        </Txt>
      </KitCard>
    </g>
  );
}

// The Q&A timer: 30 minutes, counting down once the Q&A opens, its bar draining.
function Timer({ box }: { box: Box }) {
  const barW = box.w - 28;
  return (
    <g className="hm-pop" style={at(0.8)}>
      <KitCard box={box} title="Q&A TIMER">
        <Txt
          className={`hm-out ${INK}`}
          style={at(2.4)}
          x={box.x + 14}
          y={box.y + 44}
          size={19}
          weight={800}
        >
          30:00
        </Txt>
        <Txt
          className={`hm-fade ${INK}`}
          style={at(2.4)}
          x={box.x + 14}
          y={box.y + 44}
          size={19}
          weight={800}
        >
          18:42
        </Txt>
        <Txt x={box.x + box.w - 14} y={box.y + 43} size={8.5} anchor="end" className={MUTED}>
          of 30:00
        </Txt>
        <rect x={box.x + 14} y={box.y + 54} width={barW} height="5" rx="2.5" className={TRACK} />
        <rect
          className="hm-wipe"
          style={at(2.4)}
          x={box.x + 14}
          y={box.y + 54}
          width={barW * 0.62}
          height="5"
          rx="2.5"
          fill="#f59e0b"
        />
      </KitCard>
    </g>
  );
}

// The reaction glyphs: drawn, in the room's colours, not emoji.
const HEART = 'M0 3.2c-2-2.6-6-1.4-6 1.6 0 3 6 6.2 6 6.2s6-3.2 6-6.2c0-3-4-4.2-6-1.6z';
const STAR = 'M0 -5.5l1.7 3.6 3.9.5-2.9 2.7.7 3.9L0 3.3l-3.4 1.9.7-3.9-2.9-2.7 3.9-.5z';
const SPARK = 'M0 -6c.6 3.4 2.6 5.4 6 6-3.4.6-5.4 2.6-6 6-.6-3.4-2.6-5.4-6-6 3.4-.6 5.4-2.6 6-6z';
const REACTION = [
  { path: HEART, fill: '#f43f5e', dy: -2 },
  { path: STAR, fill: '#f59e0b', dy: 0 },
  { path: SPARK, fill: '#8b5cf6', dy: 0 },
];

function Glyph({ x, y, kind, r = 11 }: { x: number; y: number; kind: number; r?: number }) {
  const g = REACTION[kind]!;
  const s = r / 11;
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={g.fill} fillOpacity="0.16" />
      <path d={g.path} fill={g.fill} transform={`translate(${x} ${y + g.dy * s}) scale(${s})`} />
    </>
  );
}

// The room's reactions: the pads and the running count, each reaction floating up as it lands.
function Reactions({ box }: { box: Box }) {
  const floats = [
    { kind: 0, d: 4.8, dx: 0 },
    { kind: 1, d: 5.6, dx: 24 },
    { kind: 2, d: 7.0, dx: -14 },
    { kind: 0, d: 8.8, dx: 12 },
    { kind: 1, d: 9.6, dx: -4 },
  ];
  const padY = box.y + 47;
  return (
    <>
      <g className="hm-pop" style={at(1.0)}>
        <KitCard box={box} title="REACTIONS">
          {REACTION.map((_, i) => (
            <Glyph key={i} x={box.x + 25 + i * 28} y={padY} kind={i} />
          ))}
          <Txt
            className={`hm-out ${INK}`}
            style={at(6)}
            x={box.x + box.w - 14}
            y={padY + 6}
            size={17}
            weight={800}
            anchor="end"
          >
            12
          </Txt>
          <Txt
            className={`hm-fade ${INK}`}
            style={at(6)}
            x={box.x + box.w - 14}
            y={padY + 6}
            size={17}
            weight={800}
            anchor="end"
          >
            64
          </Txt>
        </KitCard>
      </g>
      {floats.map((f, i) => (
        <g
          key={i}
          className="hm-float"
          style={{ ...at(f.d), transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <Glyph x={box.x + 25 + f.kind * 28 + f.dx} y={padY - 12} kind={f.kind} r={8} />
        </g>
      ))}
    </>
  );
}

// The closing poll: how useful was this, 1 to 5, the votes filling in over faint tracks.
function Poll({ box }: { box: Box }) {
  const max = Math.max(...POLL);
  const barsTop = box.y + 30;
  const barsH = box.h - 50;
  const gap = 8;
  const barW = (box.w - 28 - gap * (POLL.length - 1)) / POLL.length;
  return (
    <g className="hm-pop" style={at(1.2)}>
      <KitCard box={box} title="WAS THIS USEFUL?">
        <g className="hm-pop" style={at(8)}>
          <Txt x={box.x + box.w - 14} y={box.y + 19} size={9} weight={800} anchor="end">
            4.3 avg
          </Txt>
        </g>
        {POLL.map((n, i) => {
          const h = (n / max) * barsH;
          const x = box.x + 14 + i * (barW + gap);
          return (
            <g key={i}>
              <rect x={x} y={barsTop} width={barW} height={barsH} rx="4" className={TRACK} />
              <rect
                className="hm-grow"
                style={at(7.2 + i * 0.12)}
                x={x}
                y={barsTop + barsH - h}
                width={barW}
                height={h}
                rx="4"
                fill={i === POLL.length - 1 ? BRAND : '#7dd3fc'}
              />
              <Txt
                x={x + barW / 2}
                y={box.y + box.h - 8}
                size={8}
                weight={600}
                anchor="middle"
                className={MUTED}
              >
                {i + 1}
              </Txt>
            </g>
          );
        })}
      </KitCard>
    </g>
  );
}
