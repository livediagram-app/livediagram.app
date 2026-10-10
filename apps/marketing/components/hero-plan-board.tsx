import type { CSSProperties } from 'react';

// The hero's Plan window (docs/specs/019-marketing/marketing-site.md "Hero"): a launch board in Plan mode
// (docs/specs/026-plan/plan-board.md). Three columns of cards land, Doing showing its WIP limit as `2 / 3`. A
// teammate picks up a card in Doing and carries it to Done, ringed in their colour while they hold it; you carry
// one from To do into Doing; each column's count ticks over as its cards change. Last, a card is quick-added to
// To do, its title typed and `@sam #docs` turning into an avatar and a label. Every piece plays at its own --d
// (hero-mode-animations.css), and a phone draws the same board narrower and taller.

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const TEAMMATE = '#ec4899';
const YOU = '#0ea5e9';

// Item types' colour stripes (docs/specs/026-plan/item-types.md): Task, Bug, Idea.
const TYPE = {
  task: { colour: '#0ea5e9', prefix: 'TSK' },
  bug: { colour: '#ef4444', prefix: 'BUG' },
  idea: { colour: '#f59e0b', prefix: 'IDEA' },
} as const;
type TypeKey = keyof typeof TYPE;

type Person = { initials: string; colour: string };
const AK: Person = { initials: 'AK', colour: '#8b5cf6' };
const JR: Person = { initials: 'JR', colour: TEAMMATE };
const SM: Person = { initials: 'SM', colour: '#10b981' };
const ME: Person = { initials: 'TM', colour: YOU };

type CardDef = { title: string; type: TypeKey; n: number; who: Person; priority: string };

// Where the board sits: the wide window's landscape layout, and a phone's portrait one.
type Layout = {
  board: { x: number; y: number; w: number; h: number };
  colX: readonly [number, number, number];
  colW: number;
  top: number; // the first card's y
  cardH: number;
  gap: number;
  title: number; // card title font size
  meta: number;
  // A title wider than the column is set on two lines in the narrow layout.
  wrap: boolean;
};

const LANDSCAPE: Layout = {
  board: { x: 20, y: -36, w: 560, h: 352 },
  colX: [34, 218, 402],
  colW: 164,
  top: 36,
  cardH: 54,
  gap: 8,
  title: 11.5,
  meta: 8.5,
  wrap: false,
};

const PORTRAIT: Layout = {
  board: { x: 4, y: -24, w: 352, h: 470 },
  colX: [12, 126, 240],
  colW: 108,
  top: 54,
  cardH: 76,
  gap: 10,
  title: 11,
  meta: 8,
  wrap: true,
};

const at = (d: number, extra: Record<string, string | number> = {}) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

const slotY = (l: Layout, i: number) => l.top + i * (l.cardH + l.gap);

// The script, in seconds.
const T = {
  board: 0.2,
  headers: 0.5,
  cards: 0.9, // first card; the rest follow 0.15s apart
  teammateArrive: 2.9,
  teammateCarry: 3.7,
  youArrive: 5.2,
  youCarry: 6.0,
  quickAdd: 7.6,
  typed: 8.0,
  chips: 8.7,
} as const;
const CARRY = 0.7;

function Avatar({ x, y, who, r = 8 }: { x: number; y: number; who: Person; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={who.colour} />
      <text
        x={x}
        y={y + r * 0.36}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={r * 0.95}
        fontWeight="700"
        fill="white"
      >
        {who.initials}
      </text>
    </g>
  );
}

function TitleText({ l, x, y, text }: { l: Layout; x: number; y: number; text: string }) {
  const words = text.split(' ');
  const lines = l.wrap && words.length > 1 ? [words.slice(0, -1).join(' '), words.at(-1)!] : [text];
  return (
    <text
      className="fill-(--art-text)"
      x={x}
      y={y}
      fontFamily={FONT}
      fontSize={l.title}
      fontWeight="600"
    >
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? 0 : l.title + 2}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// One card face, Compact-style: the type's stripe, the title, then the key, a priority dot and the avatar.
function CardFace({ l, card, x, y }: { l: Layout; card: CardDef; x: number; y: number }) {
  const t = TYPE[card.type];
  const metaY = y + l.cardH - 11;
  const key = `${t.prefix}-${card.n}`;
  return (
    <g>
      <rect
        x={x + 1}
        y={y + 2}
        width={l.colW - 16}
        height={l.cardH}
        rx="6"
        fill="#0f172a"
        opacity="0.06"
      />
      <rect
        x={x}
        y={y}
        width={l.colW - 16}
        height={l.cardH}
        rx="6"
        className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
      />
      <rect x={x} y={y} width="4" height={l.cardH} rx="2" fill={t.colour} />
      <TitleText l={l} x={x + 12} y={y + 18} text={card.title} />
      <text
        className="fill-slate-500 dark:fill-slate-400"
        x={x + 12}
        y={metaY + 3}
        fontFamily={FONT}
        fontSize={l.meta}
        fontWeight="600"
      >
        {key}
      </text>
      <circle cx={x + 12 + key.length * l.meta * 0.62 + 6} cy={metaY} r="3" fill={card.priority} />
      <Avatar x={x + l.colW - 30} y={metaY} who={card.who} r={l.wrap ? 7 : 8} />
    </g>
  );
}

// A count that ticks over: each value lands at its `from` and gives way at the next one's.
function Count({
  x,
  y,
  values,
  size,
}: {
  x: number;
  y: number;
  values: { text: string; from: number }[];
  size: number;
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
            fontSize={size}
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

function Pointer({ colour, name }: { colour: string; name: string }) {
  return (
    <>
      <path
        d="M0 0 L12 7 L7 8 L9.5 12.5 L7.5 13.5 L5 9 L1.5 12.5 Z"
        fill={colour}
        stroke="white"
        strokeWidth="1"
      />
      <rect x="10" y="12" width="24" height="13" rx="3" fill={colour} />
      <text
        x="22"
        y="21.5"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="8"
        fontWeight="700"
        fill="white"
      >
        {name}
      </text>
    </>
  );
}

// A card someone carries: their pointer arrives on it, then card and pointer travel together by (dx, dy) to
// the new column, the card ringed in their colour while it is held.
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
  const grab = { x: from.x + l.colW * 0.3, y: from.y + l.cardH * 0.4 };
  return (
    <g
      className="hm-move"
      style={at(carry, { '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px` })}
    >
      <g className="hm-pop" style={at(appear)}>
        <CardFace l={l} card={card} x={from.x} y={from.y} />
      </g>
      {/* Held: their colour rings the card from pick-up until it is dropped. */}
      <g className="hm-out" style={at(carry + CARRY + 0.2)}>
        <rect
          className="hm-fade"
          style={at(arrive + 0.6)}
          x={from.x - 2}
          y={from.y - 2}
          width={l.colW - 12}
          height={l.cardH + 4}
          rx="7"
          fill="none"
          stroke={colour}
          strokeWidth="2"
        />
      </g>
      <g
        className="hm-cursor hm-carrier"
        style={
          at(arrive, {
            '--sx': `${grab.x + 90}px`,
            '--sy': `${grab.y + 70}px`,
            '--cx': `${grab.x}px`,
            '--cy': `${grab.y}px`,
          }) as CSSProperties
        }
        aria-hidden
      >
        <Pointer colour={colour} name={name} />
      </g>
    </g>
  );
}

const COLUMNS = ['To do', 'Doing', 'Done'] as const;

// The cards that stay put: [column, slot, card].
const RESTING: [number, number, CardDef][] = [
  [0, 0, { title: 'Pricing page', type: 'task', n: 14, who: AK, priority: '#f59e0b' }],
  [1, 0, { title: 'API docs', type: 'task', n: 9, who: SM, priority: '#ef4444' }],
  [2, 0, { title: 'Logo refresh', type: 'idea', n: 3, who: AK, priority: '#94a3b8' }],
  [2, 1, { title: 'Login bug', type: 'bug', n: 21, who: JR, priority: '#ef4444' }],
];
const TEAMMATE_CARD: CardDef = {
  title: 'Onboarding',
  type: 'task',
  n: 11,
  who: JR,
  priority: '#f59e0b',
};
const YOUR_CARD: CardDef = {
  title: 'Beta invites',
  type: 'task',
  n: 16,
  who: ME,
  priority: '#f59e0b',
};
const NEW_CARD = 'Release notes';

export function PlanBoard({ portrait = false }: { portrait?: boolean }) {
  const l = portrait ? PORTRAIT : LANDSCAPE;
  const cardX = (c: number) => l.colX[c]! + 8;
  const headerY = l.top - 14;
  const cardDelay = (i: number) => T.cards + i * 0.15;
  const qx = cardX(0);
  const qy = slotY(l, 1);
  return (
    <>
      {/* The board: its title and the people on it. */}
      <g className="hm-pop" style={at(T.board)}>
        <rect
          x={l.board.x}
          y={l.board.y}
          width={l.board.w}
          height={l.board.h}
          rx="10"
          className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
        />
        <text
          className="fill-(--art-text)"
          x={l.board.x + 14}
          y={l.board.y + 24}
          fontFamily={FONT}
          fontSize={portrait ? 13 : 14}
          fontWeight="700"
        >
          Launch board
        </text>
        <g>
          <Avatar x={l.board.x + l.board.w - 62} y={l.board.y + 20} who={AK} />
          <Avatar x={l.board.x + l.board.w - 46} y={l.board.y + 20} who={JR} />
          <Avatar x={l.board.x + l.board.w - 30} y={l.board.y + 20} who={SM} />
        </g>
      </g>

      {/* Columns: name, count, and Doing's WIP limit as `n / 3`. */}
      {COLUMNS.map((name, c) => (
        <g key={name} className="hm-fade" style={at(T.headers + c * 0.1)}>
          <rect
            x={l.colX[c]}
            y={headerY - 16}
            width={l.colW}
            height={l.board.y + l.board.h - headerY + 4}
            rx="8"
            className="fill-slate-100 dark:fill-slate-800/60"
          />
          <text
            className="fill-(--art-text)"
            x={l.colX[c]! + 10}
            y={headerY}
            fontFamily={FONT}
            fontSize={portrait ? 10 : 11}
            fontWeight="700"
          >
            {name}
          </text>
        </g>
      ))}
      <Count
        x={l.colX[0] + l.colW - 10}
        y={headerY}
        size={portrait ? 9 : 10}
        values={[
          { text: '2', from: T.headers },
          { text: '1', from: T.youCarry + CARRY },
          { text: '2', from: T.quickAdd },
        ]}
      />
      <Count
        x={l.colX[1] + l.colW - 10}
        y={headerY}
        size={portrait ? 9 : 10}
        values={[
          { text: '2 / 3', from: T.headers + 0.1 },
          { text: '1 / 3', from: T.teammateCarry + CARRY },
          { text: '2 / 3', from: T.youCarry + CARRY },
        ]}
      />
      <Count
        x={l.colX[2] + l.colW - 10}
        y={headerY}
        size={portrait ? 9 : 10}
        values={[
          { text: '2', from: T.headers + 0.2 },
          { text: '3', from: T.teammateCarry + CARRY },
        ]}
      />

      {RESTING.map(([c, s, card], i) => (
        <g key={card.title} className="hm-pop" style={at(cardDelay(i))}>
          <CardFace l={l} card={card} x={cardX(c)} y={slotY(l, s)} />
        </g>
      ))}

      {/* Quick add, in To do's free slot once Beta invites has moved on: the title typed, then
          `@sam #docs` becoming the assignee's avatar and a label. */}
      <g className="hm-pop" style={at(T.quickAdd)}>
        <rect
          x={qx}
          y={qy}
          width={l.colW - 16}
          height={l.cardH}
          rx="6"
          className="fill-white stroke-brand-400 dark:fill-slate-800"
          strokeWidth="1.5"
        />
        <rect x={qx} y={qy} width="4" height={l.cardH} rx="2" fill={TYPE.task.colour} />
        <text
          className="hm-type fill-(--art-text)"
          style={at(T.typed, { '--steps': NEW_CARD.length })}
          x={qx + 12}
          y={qy + 18}
          fontFamily={FONT}
          fontSize={l.wrap ? l.title - 1.5 : l.title}
          fontWeight="600"
        >
          {NEW_CARD}
        </text>
        <g className="hm-pop" style={at(T.chips)}>
          <rect
            x={qx + 12}
            y={qy + l.cardH - 20}
            width="30"
            height="13"
            rx="6.5"
            className="fill-violet-100 dark:fill-violet-500/20"
          />
          <text
            className="fill-violet-700 dark:fill-violet-200"
            x={qx + 27}
            y={qy + l.cardH - 10.5}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={l.meta}
            fontWeight="600"
          >
            docs
          </text>
        </g>
        <g className="hm-pop" style={at(T.chips + 0.2)}>
          <Avatar x={qx + l.colW - 30} y={qy + l.cardH - 13} who={SM} r={l.wrap ? 7 : 8} />
        </g>
      </g>

      {/* Carried last, so a card in flight passes over the columns. */}
      <Carried
        l={l}
        card={TEAMMATE_CARD}
        from={{ x: cardX(1), y: slotY(l, 1) }}
        to={{ x: cardX(2), y: slotY(l, 2) }}
        colour={TEAMMATE}
        name="JR"
        arrive={T.teammateArrive}
        carry={T.teammateCarry}
        appear={cardDelay(RESTING.length)}
      />
      <Carried
        l={l}
        card={YOUR_CARD}
        from={{ x: cardX(0), y: slotY(l, 1) }}
        to={{ x: cardX(1), y: slotY(l, 1) }}
        colour={YOU}
        name="You"
        arrive={T.youArrive}
        carry={T.youCarry}
        appear={cardDelay(RESTING.length + 1)}
      />
    </>
  );
}
