import { capBandBaselineY } from '@liveworkspace/icons';
import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';

// The collaboration scene (docs/specs/019-marketing/marketing-site.md "Feature scenes"): a sprint board
// (docs/specs/026-plan/plan-board.md) with three people on it at once. The columns and their twelve cards
// land; Sam opens Demo video, and the card wears their presence as the editor's card face draws it (PlanCardFace,
// docs/specs/012-collaboration/): a ring in their colour and their first name on a tag hanging from the card's top
// edge. A Board shows no one's pointer, so neither does the scene: the rings and tags say who is where, and the
// window's Sprint tab carries everyone's initials (hero-scene-data.ts). The card's comment thread opens with Sam's
// question. Maya picks up Onboarding emails, which takes her ring and tag, lifts, and carries it from In Progress to
// Done, each count ticking over. Last, you reply in the thread, @mentioning Maya to trim the intro, and the card's
// comment count goes from 1 to 2. Every piece plays at its own --d (hero-mode-animations.css); a phone draws the
// same board smaller. The board rests with 4 of its 12 cards in Done.

// The script, in seconds.
const T = {
  surface: 0.1,
  heads: 0.3,
  cards: 0.6, // the first card; the rest follow 0.05s apart
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

// The columns as they start, under the editor's default names (@liveplanner/items presets); Onboarding emails
// (In Progress, last) is the one Maya carries.
const COLUMNS: { name: string; cards: CardDef[] }[] = [
  {
    name: 'To Do',
    cards: [
      { title: 'Pricing page', id: 'TSK-21', tone: '#8b5cf6', ...U },
      { title: 'Release notes', id: 'TSK-24', tone: '#0ea5e9', ...M },
      { title: 'Press kit', id: 'TSK-25', tone: '#f59e0b', ...P },
      { title: 'Launch email', id: 'TSK-27', tone: '#ec4899', ...U },
    ],
  },
  {
    name: 'In Progress',
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
// The card the thread is on: In Progress's first.
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
        // The initials centre on their cap band (optical-alignment.md "SVG text centres on its cap band too").
        y={capBandBaselineY(y, 7)}
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
  const popOrder = new Map(COLUMNS.flatMap((col) => col.cards).map((card, n) => [card, n]));
  return (
    <>
      {COLUMNS.map((col, c) =>
        col.cards.map((card, s) => {
          const d = T.cards + popOrder.get(card)! * 0.05;
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

// Someone's presence on a card, as PlanCardFace draws it: a 2px ring in their colour just outside the card's
// border, and their first name in white on a tag in that colour hanging from the top edge near its right
// (PresenceTag, `-top-px right-2 rounded-b`).
const TAG_H = 8.5;
const TAG_R = 2;
function Presence({ x, y, name, colour }: { x: number; y: number; name: string; colour: string }) {
  const w = name.length * 3.9 + 8;
  const tx = x + CARD_W - 8 - w;
  const ty = y - 1;
  return (
    <>
      <rect
        x={x - 1}
        y={y - 1}
        width={CARD_W + 2}
        height={CARD_H + 2}
        rx="7"
        fill="none"
        stroke={colour}
        strokeWidth="2"
      />
      <path
        d={`M${tx} ${ty}h${w}v${TAG_H - TAG_R}a${TAG_R} ${TAG_R} 0 0 1 -${TAG_R} ${TAG_R}h-${w - 2 * TAG_R}a${TAG_R} ${TAG_R} 0 0 1 -${TAG_R} -${TAG_R}z`}
        fill={colour}
      />
      <text
        x={tx + w / 2}
        y={capBandBaselineY(ty + TAG_H / 2, 6.5)}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="6.5"
        fontWeight="600"
        fill="white"
      >
        {name}
      </text>
    </>
  );
}

// Sam opens Demo video: the card wears their ring and name while they have it open.
function SamOnCard() {
  return (
    <g className="hm-fade" style={at(T.ring)}>
      <Presence x={cardX(THREAD_CARD.col)} y={slotY(THREAD_CARD.slot)} name="Sam" colour={SAM} />
    </g>
  );
}

// The card's thread, opened under the board below In Progress and Done, so it covers no card: Sam's
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
          can you trim the intro?
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
      {/* You click into the reply: its box takes your focus ring before the reply types in above it. */}
      <rect
        className="hm-fade"
        style={at(T.you)}
        x={x + 10}
        y={y + h - 16}
        width={w - 20}
        height="10"
        rx="3"
        fill="none"
        stroke={YOU}
        strokeWidth="1"
      />
    </g>
  );
}

// Maya picks up Onboarding emails: it takes her ring and name, lifts and tilts as a held card does (hp-lift,
// app/hero-scenes/plan.css), and lands in Done, where she lets it go and her presence leaves it.
function Carried() {
  const from = { c: 1, s: 3 };
  const dx = colX(2) - colX(1);
  const x = cardX(from.c);
  const y = slotY(from.s);
  return (
    <g className="hm-pop" style={at(T.cards + 10 * 0.05)}>
      <g className="hm-move" style={at(T.carry, { '--dx': `${dx}px`, '--dy': '0px' })}>
        <g className="hp-lift" style={at(T.carry - 0.2)}>
          <Card x={x} y={y} card={CARRIED} />
          <g className="hm-out" style={at(T.done + 0.15)}>
            <g className="hm-fade" style={at(T.maya + 0.4)}>
              <Presence x={x} y={y} name="Maya" colour={TEAMMATE} />
            </g>
          </g>
        </g>
      </g>
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
