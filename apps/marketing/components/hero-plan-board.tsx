import type { CSSProperties } from 'react';
import { FONT, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';
import { CARD_H, CardFace, Sliders, type CardDef } from './hero-plan-card';
import { COLUMNS, MOVES, QUICK, QUICK_COLUMN, QUICK_TITLE, QUICK_TYPED } from './hero-plan-data';

// The hero's Plan window (docs/specs/019-marketing/marketing-site.md "Hero"): a launch board in Plan mode
// (docs/specs/026-plan/plan-board.md) filling its tab, as a board does in the editor. Five columns land, Backlog
// (scrolled half out of view), To do, In progress (its WIP limit as `2 / 3`), Review (`2 / 2`) and Done, each with its grey head (name, count, the
// column's sliders) and an Add Card row at its foot, and the cards land in the board's Detailed face
// (hero-plan-card.tsx). A teammate picks up a card in Review and carries it to Done, ringed in their colour and
// tilted while they hold it, a dashed slot waiting where it will drop; you carry one from To do into In progress;
// each count ticks over and the Add Card rows make room. Last, a card is quick-added to To do: its title typed
// with `@sam #docs`, which become the assignee's avatar and a label. Every piece plays at its own --d
// (hero-mode-animations.css, hero-scenes/plan.css); a phone draws narrower cards, the board running on past
// the screen's edge as a phone scrolls it.

// The script, in seconds.
const T = {
  board: 0.1,
  headers: 0.3,
  cards: 0.7, // first card; the rest follow 0.1s apart
  arrive: [2.6, 4.8], // each carrier reaches their card
  carry: [3.4, 5.6], // and sets off with it
  quickAdd: 7.2,
  typed: 7.6,
  chips: 8.8,
} as const;
const CARRY = 0.6;

type Layout = {
  x0: number; // first column's left
  colW: number;
  gap: number;
  head: number; // the column heads' top
  narrow: boolean;
};

// Five columns, as a board scrolled a little to the right: Backlog half off the left edge of the wide
// window's canvas (wider than the viewBox, as the canvas is), To do to Done across it, and the board's
// Add Column lane after them. On a phone narrower cards from To do, Done half past the screen's edge.
const LANDSCAPE: Layout = { x0: -241, colW: 172, gap: 10, head: -44, narrow: false };
const PORTRAIT: Layout = { x0: -168, colW: 116, gap: 8, head: -34, narrow: true };

const PITCH = CARD_H + 7;
const colX = (l: Layout, c: number) => l.x0 + c * (l.colW + l.gap);
const cardX = (l: Layout, c: number) => colX(l, c) + 6;
const cardW = (l: Layout) => l.colW - 12;
const slotY = (l: Layout, s: number) => l.head + 32 + s * PITCH;

// A count that ticks over: each value lands at its `from` and gives way at the next one's.
function Count({
  x,
  y,
  values,
}: {
  x: number;
  y: number;
  values: { text: string; from: number }[];
}) {
  return (
    <>
      {values.map((v, i) => {
        const next = values[i + 1];
        const label = (
          <text
            className="hm-pop fill-slate-500 dark:fill-slate-400"
            style={at(v.from)}
            x={x}
            y={y}
            textAnchor="end"
            fontFamily={FONT}
            fontSize="8.5"
            fontWeight="600"
          >
            {v.text}
          </text>
        );
        return next ? (
          <g key={v.text + v.from} className="hm-out" style={at(next.from - 0.05)}>
            {label}
          </g>
        ) : (
          <g key={v.text + v.from}>{label}</g>
        );
      })}
    </>
  );
}

// "+ Add card" at a column's foot, sliding down a slot (`dy`) to make room as a card is carried in.
function AddRow({
  l,
  c,
  slot,
  dy = 0,
  d,
}: {
  l: Layout;
  c: number;
  slot: number;
  dy?: number;
  d?: number;
}) {
  const x = cardX(l, c);
  const y = slotY(l, slot) + 12;
  const row = (
    <g className="fill-slate-400 dark:fill-slate-500">
      <path
        d={`M${x + 6} ${y - 3.5}v7M${x + 2.5} ${y}h7`}
        className="stroke-slate-400 dark:stroke-slate-500"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <text x={x + 15} y={y + 3} fontFamily={FONT} fontSize="8.5" fontWeight="500">
        Add card
      </text>
    </g>
  );
  return dy && d !== undefined ? (
    <g className="hm-move" style={at(d, { '--dy': `${dy * PITCH}px` })}>
      {row}
    </g>
  ) : (
    row
  );
}

// A card someone carries: their pointer arrives on it, then card and pointer travel together to the
// new column, the card lifted and tilted and ringed in their colour while held, and a dashed slot
// waits where it will drop.
function Carried({
  l,
  card,
  from,
  to,
  colour,
  name,
  arrive,
  carry,
  appear,
}: {
  l: Layout;
  card: CardDef;
  from: { x: number; y: number };
  to: { x: number; y: number };
  colour: string;
  name: string;
  arrive: number;
  carry: number;
  appear: number;
}) {
  const w = cardW(l);
  const grab = { x: from.x + w * 0.55, y: from.y + CARD_H * 0.58 };
  return (
    <>
      <g className="hm-out" style={at(carry + CARRY)}>
        <rect
          className="hm-fade"
          style={at(carry - 0.1)}
          x={to.x}
          y={to.y}
          width={w}
          height={CARD_H}
          rx="7"
          fill={colour}
          fillOpacity="0.06"
          stroke={colour}
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
      </g>
      <g
        className="hm-move"
        style={at(carry, { '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px` })}
      >
        <g className="hp-lift" style={at(carry - 0.2)}>
          <g className="hm-pop" style={at(appear)}>
            <CardFace card={card} x={from.x} y={from.y} w={w} narrow={l.narrow} />
          </g>
          {/* Held: their colour rings the card from pick-up until it is dropped. */}
          <g className="hm-out" style={at(carry + CARRY + 0.15)}>
            <rect
              className="hm-fade"
              style={at(arrive + 0.6)}
              x={from.x - 2}
              y={from.y - 2}
              width={w + 4}
              height={CARD_H + 4}
              rx="8.5"
              fill="none"
              stroke={colour}
              strokeWidth="2"
            />
          </g>
        </g>
        <g
          className="hm-cursor hm-carrier"
          style={
            at(arrive, {
              '--sx': `${grab.x + 90}px`,
              '--sy': `${grab.y + 80}px`,
              '--cx': `${grab.x}px`,
              '--cy': `${grab.y}px`,
            }) as CSSProperties
          }
          aria-hidden
        >
          <CursorMark colour={colour} label={name} badge="name" />
        </g>
      </g>
    </>
  );
}

// Each column's count over the script: `n` or, with a WIP limit, `n / limit`.
function counts(c: number): { text: string; from: number }[] {
  const col = COLUMNS[c]!;
  const fmt = (n: number) => (col.wip ? `${n} / ${col.wip}` : `${n}`);
  let n = col.cards.length;
  const events: { at: number; delta: number }[] = [];
  MOVES.forEach((m, i) => {
    const drop = T.carry[i]! + CARRY;
    if (m.from === c) events.push({ at: drop, delta: -1 });
    if (m.to === c) events.push({ at: drop, delta: 1 });
  });
  if (c === QUICK_COLUMN) events.push({ at: T.chips, delta: 1 });
  const values = [{ text: fmt(n), from: T.headers + c * 0.08 }];
  for (const e of events.sort((a, b) => a.at - b.at)) {
    n += e.delta;
    values.push({ text: fmt(n), from: e.at });
  }
  return values;
}

export function PlanBoard({ portrait = false }: { portrait?: boolean }) {
  const l = portrait ? PORTRAIT : LANDSCAPE;
  const w = cardW(l);
  const moving = new Set<number>(MOVES.map((m) => m.from));
  let order = 0;
  const qx = cardX(l, QUICK_COLUMN);
  // The quick add takes the slot the carried card left.
  const qy = slotY(l, COLUMNS[QUICK_COLUMN]!.cards.length - 1);
  return (
    <>
      {/* The board fills the tab: its surface, edge to edge under the toolbar row. */}
      <rect
        className="hm-fade fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-800"
        style={at(T.board)}
        x="-600"
        y={l.head - 8}
        width="1800"
        height="900"
        strokeWidth="0.8"
      />

      {/* Columns: a grey head (name, count, sliders) over a lane that runs on below the window. */}
      {COLUMNS.map((col, c) => (
        <g key={col.name} className="hm-fade" style={at(T.headers + c * 0.08)}>
          <rect
            x={colX(l, c)}
            y={l.head}
            width={l.colW}
            height="22"
            rx="6"
            className="fill-slate-100 dark:fill-slate-800"
          />
          <rect
            x={colX(l, c) + 8}
            y={l.head + 2.5}
            width={l.colW - 16}
            height="2"
            rx="1"
            className="fill-slate-300 dark:fill-slate-600"
          />
          <text
            x={colX(l, c) + 9}
            y={l.head + 15.5}
            fontFamily={FONT}
            fontSize={portrait ? 9 : 9.5}
            fontWeight="700"
            className="fill-(--art-text) dark:fill-slate-100"
          >
            {col.name}
          </text>
          <Sliders x={colX(l, c) + l.colW - 17} y={l.head + 12.5} />
          <rect
            x={colX(l, c)}
            y={l.head + 26}
            width={l.colW}
            height="700"
            rx="6"
            className="fill-slate-100/70 dark:fill-slate-800/45"
          />
        </g>
      ))}
      {/* The board's Add Column lane, after its last column. */}
      <g className="hm-fade" style={at(T.headers + 0.4)}>
        <rect
          x={colX(l, COLUMNS.length)}
          y={l.head}
          width={l.colW}
          height="700"
          rx="6"
          fill="none"
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeDasharray="4 3"
        />
        <text
          x={colX(l, COLUMNS.length) + 10}
          y={l.head + 15.5}
          fontFamily={FONT}
          fontSize="9"
          fontWeight="600"
          className="fill-slate-400 dark:fill-slate-500"
        >
          + Add column
        </text>
      </g>
      {COLUMNS.map((_, c) => (
        <Count key={c} x={colX(l, c) + l.colW - 23} y={l.head + 15.5} values={counts(c)} />
      ))}

      {/* The cards that stay put. */}
      {COLUMNS.map((col, c) =>
        col.cards.map((card, s) =>
          moving.has(c) && s === col.cards.length - 1 ? null : (
            <g key={card.title} className="hm-pop" style={at(T.cards + order++ * 0.1)}>
              <CardFace card={card} x={cardX(l, c)} y={slotY(l, s)} w={w} narrow={l.narrow} />
            </g>
          ),
        ),
      )}

      {/* Each column's Add Card row, making room as a card lands above it. */}
      {COLUMNS.map((col, c) => {
        const into = MOVES.findIndex((m) => m.to === c);
        return (
          <g key={col.name} className="hm-fade" style={at(T.headers + 0.3 + c * 0.08)}>
            <AddRow
              l={l}
              c={c}
              slot={col.cards.length}
              dy={into < 0 ? 0 : 1}
              d={into < 0 ? undefined : (T.carry as readonly number[])[into]! - 0.15}
            />
          </g>
        );
      })}

      {/* Quick add, in To do's free slot once Beta invites has moved on: the title typed with `@sam
          #docs`, then the card as it lands, its label and assignee in place. */}
      <g className="hm-pop" style={at(T.quickAdd)}>
        <g className="hm-out" style={at(T.chips)}>
          <rect
            x={qx}
            y={qy}
            width={w}
            height={CARD_H}
            rx="7"
            className="fill-white stroke-brand-400 dark:fill-slate-800"
            strokeWidth="1.5"
          />
          <text
            className="hm-type hp-type-slow fill-(--art-text) dark:fill-slate-100"
            style={at(T.typed, { '--steps': QUICK_TYPED.length })}
            x={qx + 9}
            y={qy + 22}
            fontFamily={FONT}
            fontSize={portrait ? 8.5 : 9.5}
            fontWeight="600"
          >
            {QUICK_TITLE} <tspan className="fill-sky-600 dark:fill-sky-300">@sam</tspan>{' '}
            <tspan className="fill-violet-600 dark:fill-violet-300">#docs</tspan>
          </text>
          <text
            x={qx + 9}
            y={qy + CARD_H - 10}
            fontFamily={FONT}
            fontSize="7"
            className="fill-slate-400"
          >
            Enter to add · Esc to cancel
          </text>
        </g>
        <g className="hm-pop" style={at(T.chips)}>
          <CardFace card={QUICK} x={qx} y={qy} w={w} narrow={l.narrow} />
        </g>
      </g>

      {/* Carried last, so a card in flight passes over the columns. */}
      {MOVES.map((m, i) => {
        const fromCol = COLUMNS[m.from]!;
        return (
          <Carried
            key={m.name}
            l={l}
            card={fromCol.cards.at(-1)!}
            from={{ x: cardX(l, m.from), y: slotY(l, fromCol.cards.length - 1) }}
            to={{ x: cardX(l, m.to), y: slotY(l, COLUMNS[m.to]!.cards.length) }}
            colour={m.who}
            name={m.name}
            arrive={T.arrive[i]!}
            carry={T.carry[i]!}
            appear={T.cards + (order + i) * 0.1}
          />
        );
      })}
    </>
  );
}
