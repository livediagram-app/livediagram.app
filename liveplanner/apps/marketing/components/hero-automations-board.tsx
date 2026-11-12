import { FONT, TEAMMATE, YOU, at } from '@/components/art-tokens';
import { AddCardRow, CARRY, Carried, ColumnLane, Count } from './hero-board-parts';
import { CARD_H, CardFace, type CardDef, type Person } from './hero-plan-card';
import { AuditTrail, RulePanel, SlackPost, type Run } from './hero-automations-rule';

// The Automations beat's window (docs/specs/019-marketing/marketing-site.md "Feature scenes"): a launch board
// of three columns beside the Automations screen's rule Stamp the Finish Date (docs/specs/026-plan/
// automations.md), drawn as its builder draws it: When Card Moved to Done, Then Set Completed On to Today, Then
// Post to Slack. A teammate carries Pricing page from Review to Done; the rule's When lights, each Then ticks in
// turn as the card gains its Completed chip and the Slack post lands, and the Audit Trail logs the run while Runs
// today ticks over. You carry Beta invites to Done a moment later and it all happens again. Every piece plays at
// its own --d (hero-mode-animations.css); a phone draws the rule under the board.

const AK: Person = { initials: 'AK', colour: '#8b5cf6' };
const JR: Person = { initials: 'JR', colour: TEAMMATE };
const SM: Person = { initials: 'SM', colour: '#10b981' };
const ME: Person = { initials: 'TM', colour: YOU };

// The script, in seconds: the board and the rule build, then two runs, one per carried card.
const T = {
  board: 0.1,
  headers: 0.3,
  cards: 0.6, // first card; the rest follow 0.1s apart
  rule: 1.0,
  runs: [
    { arrive: 2.4, carry: 3.2 },
    { arrive: 6.4, carry: 7.2 },
  ],
} as const;

// What each run does after its card drops: the When lights, the two Thens tick, the post lands, the
// Audit Trail logs it.
const fire = (drop: number) => ({
  when: drop + 0.2,
  stamp: drop + 0.6,
  post: drop + 1.0,
  logged: drop + 1.5,
});

type Column = { name: string; cards: CardDef[] };

// The board as it opens; each carried card is the last in its column, so nothing closes up behind it.
const COLUMNS: Column[] = [
  {
    name: 'In progress',
    cards: [
      {
        title: 'Onboarding',
        type: 'task',
        n: 21,
        who: SM,
        priority: 'medium',
        label: 'docs',
        due: { text: '18 Oct' },
      },
      { title: 'Beta invites', type: 'task', n: 16, who: ME, priority: 'medium' },
    ],
  },
  {
    name: 'Review',
    cards: [
      { title: 'Press kit', type: 'idea', n: 19, who: JR, priority: 'low', label: 'press' },
      { title: 'Pricing page', type: 'task', n: 14, who: AK, priority: 'high' },
    ],
  },
  {
    name: 'Done',
    cards: [
      {
        title: 'Launch plan',
        type: 'task',
        n: 9,
        who: SM,
        priority: 'medium',
        label: 'growth',
        checklist: { done: 4, of: 4 },
      },
    ],
  },
];
const DONE = 2;
const MOVES = [
  { from: 1, who: TEAMMATE, name: 'JR' },
  { from: 0, who: YOU, name: 'TM' },
] as const;

type Layout = {
  x0: number; // first column's left
  colW: number;
  gap: number;
  head: number; // the column heads' top
  narrow: boolean;
  rule: { x: number; y: number; w: number };
  post: { x: number; y: number; w: number };
};
const LANDSCAPE: Layout = {
  x0: 12,
  colW: 124,
  gap: 8,
  head: -44,
  narrow: false,
  rule: { x: 414, y: -44, w: 174 },
  post: { x: 22, y: 232, w: 248 },
};
const PORTRAIT: Layout = {
  x0: 12,
  colW: 108,
  gap: 6,
  head: -34,
  narrow: true,
  rule: { x: 12, y: 262, w: 336 },
  post: { x: 18, y: 168, w: 214 },
};

const PITCH = CARD_H + 7;
const colX = (l: Layout, c: number) => l.x0 + c * (l.colW + l.gap);
const cardX = (l: Layout, c: number) => colX(l, c) + 6;
const cardW = (l: Layout) => l.colW - 12;
const slotY = (l: Layout, s: number) => l.head + 32 + s * PITCH;

// The Completed On date the rule stamps, as a chip in the card's footer: the bolt says a rule set it.
function Stamped({ x, y, d }: { x: number; y: number; d: number }) {
  return (
    <g className="hm-pop" style={at(d)}>
      <rect
        x={x}
        y={y - 6.5}
        width="50"
        height="13"
        rx="3.5"
        className="fill-emerald-50 dark:fill-emerald-500/15"
      />
      <path
        d={`M${x + 7.4} ${y - 4.2}l-3 4.2h2.2l-.5 3.2 3-4.2h-2.2z`}
        className="fill-emerald-600 dark:fill-emerald-300"
      />
      <text
        x={x + 12}
        y={y + 2.7}
        fontFamily={FONT}
        fontSize="7.6"
        fontWeight="600"
        className="fill-emerald-700 dark:fill-emerald-300"
      >
        12 Nov
      </text>
    </g>
  );
}

function Scene({ l }: { l: Layout }) {
  const w = cardW(l);
  const drops = T.runs.map((r) => r.carry + CARRY);
  const runs: Run[] = MOVES.map((m, i) => ({
    ...fire(drops[i]!),
    card: COLUMNS[m.from]!.cards.at(-1)!,
  }));
  const moving = new Set<number>(MOVES.map((m) => m.from));
  let order = 0;

  // Each column's count: down one as its card leaves, Done up one as each lands.
  const counts = (c: number) => {
    let n = COLUMNS[c]!.cards.length;
    const values = [{ text: `${n}`, from: T.headers + c * 0.08 }];
    MOVES.forEach((m, i) => {
      if (m.from === c) values.push({ text: `${--n}`, from: drops[i]! });
      if (c === DONE) values.push({ text: `${++n}`, from: drops[i]! });
    });
    return values;
  };

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
      {COLUMNS.map((col, c) => (
        <ColumnLane
          key={col.name}
          x={colX(l, c)}
          y={l.head}
          w={l.colW}
          name={col.name}
          small={l.narrow}
          d={T.headers + c * 0.08}
        />
      ))}
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

      {/* Each column's Add Card row; Done's makes room for each card that lands. */}
      {COLUMNS.map((col, c) => (
        <g key={col.name} className="hm-fade" style={at(T.headers + 0.3 + c * 0.08)}>
          {c === DONE ? (
            <g className="hm-move" style={at(drops[1]! - 0.15, { '--dy': `${PITCH}px` })}>
              <AddCardRow
                x={cardX(l, c)}
                y={slotY(l, col.cards.length) + 12}
                dy={PITCH}
                d={drops[0]! - 0.15}
              />
            </g>
          ) : (
            <AddCardRow x={cardX(l, c)} y={slotY(l, col.cards.length - 1) + 12} />
          )}
        </g>
      ))}

      <RulePanel at={l.rule} d={T.rule} runs={runs} />
      <AuditTrail at={l.rule} d={T.rule} runs={runs} />

      {/* Carried after the columns, so a card in flight passes over them; the rule's chips and posts land on top. */}
      {MOVES.map((m, i) => {
        const fromCol = COLUMNS[m.from]!;
        return (
          <Carried
            key={m.name}
            w={w}
            narrow={l.narrow}
            card={fromCol.cards.at(-1)!}
            from={{ x: cardX(l, m.from), y: slotY(l, fromCol.cards.length - 1) }}
            to={{ x: cardX(l, DONE), y: slotY(l, COLUMNS[DONE]!.cards.length + i) }}
            colour={m.who}
            name={m.name}
            arrive={T.runs[i]!.arrive}
            carry={T.runs[i]!.carry}
            appear={T.cards + (order + i) * 0.1}
          />
        );
      })}

      {/* Each card's Completed chip, stamped by the rule where it landed in Done. */}
      {runs.map((run, i) => (
        <Stamped
          key={run.card.title}
          x={cardX(l, DONE) + 8}
          y={slotY(l, COLUMNS[DONE]!.cards.length + i) + CARD_H - 14}
          d={run.stamp}
        />
      ))}

      {/* The Slack post for each run, the second taking the first's place. */}
      {runs.map((run, i) => {
        const next = runs[i + 1];
        const post = <SlackPost at={l.post} title={run.card.title} d={run.post} />;
        return next ? (
          <g key={run.card.title} className="hm-out" style={at(next.post - 0.1)}>
            {post}
          </g>
        ) : (
          <g key={run.card.title}>{post}</g>
        );
      })}
    </>
  );
}

export function AutomationsBoard({ portrait = false }: { portrait?: boolean }) {
  return <Scene l={portrait ? PORTRAIT : LANDSCAPE} />;
}
