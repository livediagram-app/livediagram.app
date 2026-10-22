import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The collaboration scene (docs/specs/019-marketing/marketing-site.md "Feature scenes"): a sprint board
// (docs/specs/026-plan/plan-board.md) with three people on it at once. The columns and their twelve cards
// land; Sam arrives on Demo video, outlined in their colour with their name beside it
// (docs/specs/012-collaboration/), and the card's comment thread opens with their question. Maya picks up
// Onboarding emails and carries it from In progress to Done, each count ticking over. Last, you reply in
// the thread, @mentioning Maya, and the card's comment count goes from 1 to 2. Every piece plays at its
// own --d (hero-mode-animations.css); a phone draws the same board smaller. The board rests with 4 of its
// 12 cards in Done, as the board bar over it says (PlanBoardBar, "33% done · 4/12").

// The script, in seconds.
const T = {
  surface: 0.1,
  heads: 0.3,
  cards: 0.6, // the first card; the rest follow 0.05s apart
  sam: 1.8,
  ring: 2.5,
  thread: 2.9,
  question: 3.1,
  maya: 3.6,
  carry: 4.4,
  done: 5.0,
  you: 5.4,
  reply: 6.1,
  count: 6.7,
} as const;

// Sam's colour: a third person, beside you and the teammate.
const SAM = '#f59e0b';

const X0 = -30;
const COL_W = 196;
const GAP = 12;
const HEAD_Y = -44;
const CARD_W = COL_W - 16;
const CARD_H = 32;
const PITCH = CARD_H + 6;
const colX = (c: number) => X0 + c * (COL_W + GAP);
const cardX = (c: number) => colX(c) + 8;
const slotY = (s: number) => HEAD_Y + 30 + s * PITCH;
// A column's well: its heading and four cards, with room at the foot.
const WELL_H = 186;

const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const SURFACE = 'fill-slate-50 dark:fill-slate-950';
const WELL = 'fill-slate-100 dark:fill-slate-800';
const MUTED = 'fill-slate-500 dark:fill-slate-400';
const INK = 'fill-(--art-text) dark:fill-slate-100';
const POPOVER =
  'fill-white stroke-slate-200 drop-shadow-[0_6px_12px_rgb(15_23_42/0.14)] dark:fill-slate-900 dark:stroke-slate-700 dark:drop-shadow-none';

type CardDef = { title: string; id: string; tone: string; who: string; colour: string };

const P = { who: 'SM', colour: SAM };
const M = { who: 'MK', colour: TEAMMATE };
const U = { who: 'TM', colour: YOU };

// The columns as they start; Onboarding emails (In progress, last) is the one Maya carries.
const COLUMNS: { name: string; cards: CardDef[] }[] = [
  {
    name: 'To do',
    cards: [
      { title: 'Pricing page', id: 'TSK-21', tone: '#8b5cf6', ...U },
      { title: 'Release notes', id: 'TSK-24', tone: '#0ea5e9', ...M },
      { title: 'Press kit', id: 'TSK-25', tone: '#f59e0b', ...P },
      { title: 'Launch email', id: 'TSK-27', tone: '#ec4899', ...U },
    ],
  },
  {
    name: 'In progress',
    cards: [
      { title: 'Demo video', id: 'TSK-18', tone: '#8b5cf6', ...P },
      { title: 'Status page', id: 'TSK-19', tone: '#0ea5e9', ...U },
      { title: 'Blog post', id: 'TSK-20', tone: '#ec4899', ...M },
    ],
  },
  {
    name: 'Done',
    cards: [
      { title: 'Beta invites', id: 'TSK-11', tone: '#10b981', ...M },
      { title: 'Help articles', id: 'TSK-12', tone: '#10b981', ...P },
      { title: 'Brand refresh', id: 'TSK-14', tone: '#10b981', ...U },
    ],
  },
];
const CARRIED: CardDef = { title: 'Onboarding emails', id: 'TSK-16', tone: '#0ea5e9', ...M };
// The card the thread is on: In progress's first.
const THREAD_CARD = { col: 1, slot: 0 } as const;

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
            className={`hm-pop ${MUTED}`}
            style={at(v.from)}
            x={x}
            y={y}
            textAnchor="end"
            fontFamily={FONT}
            fontSize="9"
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

function Avatar({ x, y, who, colour }: { x: number; y: number; who: string; colour: string }) {
  return (
    <>
      <circle cx={x} cy={y} r="8" fill={colour} />
      <text
        x={x}
        y={y + 2.8}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="7"
        fontWeight="700"
        fill="white"
      >
        {who}
      </text>
    </>
  );
}

// The comment glyph and its count, at a card's foot.
function CommentCount({ x, y, n }: { x: number; y: number; n: string }) {
  return (
    <>
      <path
        d={`M${x} ${y - 6}h9a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5h-5l-3 2.5v-2.5h-1a1.5 1.5 0 0 1-1.5-1.5v-4.5a1.5 1.5 0 0 1 1.5-1.5z`}
        className="stroke-slate-400 dark:stroke-slate-500"
        fill="none"
        strokeWidth="1"
      />
      <text x={x + 14} y={y + 1} fontFamily={FONT} fontSize="8" fontWeight="600" className={MUTED}>
        {n}
      </text>
    </>
  );
}

function Card({ x, y, card }: { x: number; y: number; card: CardDef }) {
  return (
    <>
      <rect x={x} y={y} width={CARD_W} height={CARD_H} rx="6" className={PANEL} strokeWidth="0.8" />
      <rect x={x} y={y + 6} width="3" height={CARD_H - 12} rx="1.5" fill={card.tone} />
      <text x={x + 10} y={y + 14} fontFamily={FONT} fontSize="9" fontWeight="600" className={INK}>
        {card.title}
      </text>
      <text x={x + 10} y={y + 25} fontFamily={FONT} fontSize="7" className={MUTED}>
        {card.id}
      </text>
      <Avatar x={x + CARD_W - 13} y={y + CARD_H / 2} who={card.who} colour={card.colour} />
    </>
  );
}

function Columns() {
  return (
    <>
      {COLUMNS.map((col, c) => (
        <g key={col.name} className="hm-fade" style={at(T.heads)}>
          <rect x={colX(c)} y={HEAD_Y} width={COL_W} height={WELL_H} rx="8" className={WELL} />
          <text
            x={colX(c) + 10}
            y={HEAD_Y + 16}
            fontFamily={FONT}
            fontSize="9.5"
            fontWeight="700"
            className={INK}
          >
            {col.name}
          </text>
        </g>
      ))}
      <Count x={colX(0) + COL_W - 10} y={HEAD_Y + 16} values={[{ text: '4', from: T.heads }]} />
      <Count
        x={colX(1) + COL_W - 10}
        y={HEAD_Y + 16}
        values={[
          { text: '4', from: T.heads },
          { text: '3', from: T.done },
        ]}
      />
      <Count
        x={colX(2) + COL_W - 10}
        y={HEAD_Y + 16}
        values={[
          { text: '3', from: T.heads },
          { text: '4', from: T.done },
        ]}
      />
    </>
  );
}

function Cards() {
  let i = 0;
  return (
    <>
      {COLUMNS.map((col, c) =>
        col.cards.map((card, s) => {
          const d = T.cards + i++ * 0.05;
          const thread = c === THREAD_CARD.col && s === THREAD_CARD.slot;
          return (
            <g key={card.id} className="hm-pop" style={at(d)}>
              <Card x={cardX(c)} y={slotY(s)} card={card} />
              {thread ? (
                <>
                  <g className="hm-out" style={at(T.count - 0.05)}>
                    <CommentCount x={cardX(c) + CARD_W - 56} y={slotY(s) + 24} n="1" />
                  </g>
                  <g className="hm-pop" style={at(T.count)}>
                    <CommentCount x={cardX(c) + CARD_W - 56} y={slotY(s) + 24} n="2" />
                  </g>
                </>
              ) : null}
            </g>
          );
        }),
      )}
    </>
  );
}

// Sam on Demo video: their cursor arrives, and the card wears their colour and name, as a selection does.
function SamOnCard() {
  const x = cardX(THREAD_CARD.col);
  const y = slotY(THREAD_CARD.slot);
  return (
    <>
      <g className="hm-fade" style={at(T.ring)}>
        <rect
          x={x - 2}
          y={y - 2}
          width={CARD_W + 4}
          height={CARD_H + 4}
          rx="7.5"
          fill="none"
          stroke={SAM}
          strokeWidth="1.6"
        />
        <rect x={x + CARD_W - 30} y={y - 9} width="30" height="11" rx="3" fill={SAM} />
        <text
          x={x + CARD_W - 15}
          y={y - 1}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="700"
          fill="white"
        >
          Sam
        </text>
      </g>
      <g
        className="hm-cursor"
        style={at(T.sam, {
          '--sx': '-80px',
          '--sy': '260px',
          '--cx': `${x + 60}px`,
          '--cy': `${y + 18}px`,
        })}
        aria-hidden
      >
        <CursorMark colour={SAM} label="Sam" badge="name" />
      </g>
    </>
  );
}

// The card's thread, opened under the board below In progress and Done, so it covers no card: Sam's
// question, then your reply typed in.
const THREAD = { x: cardX(1), y: HEAD_Y + WELL_H + 10, w: 2 * COL_W + GAP - 16, h: 104 };

function Thread() {
  const { x, y, w, h } = THREAD;
  return (
    <g className="hm-pop" style={at(T.thread)}>
      <rect x={x} y={y} width={w} height={h} rx="8" className={POPOVER} strokeWidth="0.8" />
      <text x={x + 12} y={y + 17} fontFamily={FONT} fontSize="9" fontWeight="700" className={INK}>
        Demo video
      </text>
      <text
        x={x + w - 12}
        y={y + 17}
        textAnchor="end"
        fontFamily={FONT}
        fontSize="7.5"
        fontWeight="600"
        className={MUTED}
      >
        Resolve
      </text>
      <path
        d={`M${x} ${y + 25}H${x + w}`}
        className="stroke-slate-100 dark:stroke-slate-800"
        strokeWidth="0.8"
      />

      <g className="hm-pop" style={at(T.question)}>
        <Avatar x={x + 20} y={y + 42} who="SM" colour={SAM} />
        <text x={x + 34} y={y + 39} fontFamily={FONT} fontSize="8" fontWeight="700" fill={SAM}>
          Sam
        </text>
        <text x={x + 34} y={y + 50} fontFamily={FONT} fontSize="8.5" className={INK}>
          Can we cut it to 60 seconds?
        </text>
      </g>

      <g className="hm-pop" style={at(T.reply)}>
        <Avatar x={x + 20} y={y + 72} who="TM" colour={YOU} />
        <text x={x + 34} y={y + 69} fontFamily={FONT} fontSize="8" fontWeight="700" fill={YOU}>
          You
        </text>
      </g>
      <g className="hm-type" style={at(T.reply, { '--steps': 32 })}>
        <text x={x + 34} y={y + 80} fontFamily={FONT} fontSize="8.5" className={INK}>
          <tspan fill={TEAMMATE} fontWeight="600">
            @Maya
          </tspan>{' '}
          yes, I’ll trim the intro
        </text>
      </g>
      <rect
        x={x + 10}
        y={y + h - 16}
        width={w - 20}
        height="10"
        rx="3"
        className="fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
        strokeWidth="0.6"
      />
      <text x={x + 15} y={y + h - 8.5} fontFamily={FONT} fontSize="6.5" className={MUTED}>
        Reply…
      </text>
    </g>
  );
}

// Maya carries Onboarding emails from In progress to Done, ringed in her colour while she holds it.
function Carried() {
  const from = { c: 1, s: 3 };
  const dx = colX(2) - colX(1);
  const x = cardX(from.c);
  const y = slotY(from.s);
  return (
    <>
      <g className="hm-pop" style={at(T.cards + 10 * 0.05)}>
        <g className="hm-move" style={at(T.carry, { '--dx': `${dx}px`, '--dy': '0px' })}>
          <Card x={x} y={y} card={CARRIED} />
          <g className="hm-out" style={at(T.done)}>
            <rect
              className="hm-fade"
              style={at(T.maya + 0.6)}
              x={x - 2}
              y={y - 2}
              width={CARD_W + 4}
              height={CARD_H + 4}
              rx="7.5"
              fill="none"
              stroke={TEAMMATE}
              strokeWidth="1.6"
            />
          </g>
        </g>
      </g>
      <g
        className="hm-cursor"
        style={at(T.maya, {
          '--sx': '200px',
          '--sy': '320px',
          '--cx': `${x + 120}px`,
          '--cy': `${y + 20}px`,
        })}
        aria-hidden
      >
        <g className="hm-move" style={at(T.carry, { '--dx': `${dx}px`, '--dy': '0px' })}>
          <CursorMark colour={TEAMMATE} label="Maya" badge="wide-name" />
        </g>
      </g>
    </>
  );
}

// Your cursor comes to the thread's reply.
function You() {
  return (
    <g
      className="hm-cursor"
      style={at(T.you, {
        '--sx': '640px',
        '--sy': '300px',
        '--cx': `${THREAD.x + 150}px`,
        '--cy': `${THREAD.y + 84}px`,
      })}
      aria-hidden
    >
      <CursorMark colour={YOU} label="You" badge="name" />
    </g>
  );
}

function Board() {
  return (
    <>
      <rect
        className={`hm-fade ${SURFACE}`}
        style={at(T.surface)}
        x="-600"
        y="-60"
        width="1800"
        height="900"
      />
      {/* The board sits a little down the tab, centred under the toolbar. */}
      <g transform="translate(0 40)">
        <Columns />
        <Cards />
        <Carried />
        <SamOnCard />
        <Thread />
        <You />
      </g>
    </>
  );
}

export function TogetherBoard({ portrait = false }: { portrait?: boolean }) {
  // A phone draws the same board smaller, its Done column running past the screen's edge.
  return portrait ? (
    <g transform="translate(10 30) scale(0.6)">
      <Board />
    </g>
  ) : (
    <Board />
  );
}
