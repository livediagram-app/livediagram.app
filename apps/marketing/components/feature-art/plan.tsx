// Feature art for the Plans & boards category (docs/specs/019-marketing/marketing-site.md,
// docs/specs/026-plan/plan-board.md, plan-views.md, board-widgets.md, item-types.md): a board
// over its WIP limit, one card on two boards, a card type's fields, the Gantt view, the header
// widgets and a retro's face-down cards. Each is a finished board at rest; the fa-f-* loops
// carry the cards and turn them over (mode-parts.tsx).

import {
  at,
  Avatar,
  BAR,
  Cursor,
  INK,
  MUTED,
  Pill,
  Stage,
  SURFACE,
  TEAMMATE,
  TextLines,
  WELL,
  YOU,
} from './mode-parts';

// Item types' colour stripes (docs/specs/026-plan/item-types.md), and Bug, a team's own type.
const TYPE = {
  project: '#8b5cf6',
  task: '#0ea5e9',
  note: '#64748b',
  idea: '#f59e0b',
  action: '#10b981',
  bug: '#ef4444',
} as const;
type TypeKey = keyof typeof TYPE;

type Person = { initials: string; colour: string };
const AK: Person = { initials: 'AK', colour: '#8b5cf6' };
const SM: Person = { initials: 'SM', colour: '#10b981' };
const JR: Person = { initials: 'JR', colour: TEAMMATE };
const TM: Person = { initials: 'TM', colour: YOU };

const AMBER_RING = '#fbbf24';

/** A card as the board draws it: its type's stripe, a title, its number and who has it. */
function PlanCard({
  x,
  y,
  w = 62,
  title,
  id,
  type = 'task',
  who,
  ring,
}: {
  x: number;
  y: number;
  w?: number;
  title: string;
  id: string;
  type?: TypeKey;
  who?: Person;
  ring?: string;
}) {
  return (
    <g>
      <rect
        className={ring ? 'fill-white dark:fill-slate-800' : SURFACE}
        x={x}
        y={y}
        width={w}
        height="19"
        rx="2.5"
        fill="#fff"
        stroke={ring ?? '#e2e8f0'}
        strokeWidth={ring ? 1.2 : 0.8}
      />
      <rect x={x} y={y} width="2.2" height="19" rx="1" fill={TYPE[type]} />
      <text className={INK} x={x + 5.5} y={y + 7.8} fontSize="6.2" fontWeight="600" fill="#1e293b">
        {title}
      </text>
      <text className={MUTED} x={x + 5.5} y={y + 15.4} fontSize="5" fontWeight="500" fill="#64748b">
        {id}
      </text>
      {who ? (
        <Avatar x={x + w - 6} y={y + 13} initials={who.initials} colour={who.colour} r={3.6} />
      ) : null}
    </g>
  );
}

/** A column's heading: its name and, when given, its count. */
function ColumnHead({ x, y, name, count }: { x: number; y: number; name: string; count?: string }) {
  return (
    <g>
      <text className={INK} x={x} y={y} fontSize="6.4" fontWeight="700" fill="#1e293b">
        {name}
      </text>
      {count ? (
        <text
          className={MUTED}
          x={x + name.length * 3.9 + 3.5}
          y={y}
          fontSize="6"
          fontWeight="600"
          fill="#64748b"
        >
          {count}
        </text>
      ) : null}
    </g>
  );
}

/** A board: a teammate carries a card into Doing, past its WIP limit of 2, and the count turns amber. */
export function PlanBoardArt() {
  const cols = [20, 112, 204];
  return (
    <Stage>
      <rect className={SURFACE} x="12" y="4" width="276" height="90" rx="5" strokeWidth="0.8" />
      <text className={INK} x={20} y={14.5} fontSize="7" fontWeight="800" fill="#1e293b">
        Launch board
      </text>
      <Avatar x={262} y={12} initials="AK" colour={AK.colour} r={3.8} />
      <Avatar x={270} y={12} initials="SM" colour={SM.colour} r={3.8} />
      <Avatar x={278} y={12} initials="JR" colour={JR.colour} r={3.8} />

      {cols.map((x, i) => (
        <rect
          key={x}
          className={
            i === 1
              ? 'fill-amber-50 stroke-amber-300 dark:fill-amber-500/10 dark:stroke-amber-500/50'
              : WELL
          }
          x={x}
          y={18}
          width="76"
          height="74"
          rx="3.5"
          fill={i === 1 ? '#fffbeb' : '#f8fafc'}
          stroke={i === 1 ? '#fcd34d' : '#e2e8f0'}
          strokeWidth="0.8"
        />
      ))}
      <ColumnHead x={25} y={26.5} name="To do" count="1" />
      <ColumnHead x={117} y={26.5} name="Doing" />
      <ColumnHead x={209} y={26.5} name="Done" count="2" />

      {/* Doing's count against its limit: 2 / 2 until the card lands, then over, in amber. */}
      <text
        className="fa-f-out fill-slate-500 dark:fill-slate-400"
        x={142}
        y={26.5}
        fontSize="6"
        fontWeight="600"
        fill="#64748b"
      >
        2 / 2
      </text>
      <g className="fa-f-on">
        <rect
          className="fill-amber-100 dark:fill-amber-500/25"
          x={140}
          y={20.7}
          width="27"
          height="8.6"
          rx="4.3"
          fill="#fef3c7"
        />
        <path d="M145 22.7 L147.6 27.3 L142.4 27.3 Z" fill="#f59e0b" />
        <text
          className="fill-amber-700 dark:fill-amber-200"
          x={149.6}
          y={27.1}
          fontSize="6"
          fontWeight="700"
          fill="#b45309"
        >
          3 / 2
        </text>
      </g>

      <PlanCard x={24} y={31} w={68} title="Pricing page" id="TSK-14" who={AK} />
      <PlanCard x={116} y={31} w={68} title="API docs" id="TSK-9" who={SM} />
      <PlanCard x={116} y={51.5} w={68} title="Login bug" id="BUG-21" type="bug" who={TM} />
      <PlanCard x={208} y={31} w={68} title="Logo refresh" id="IDEA-3" type="idea" who={AK} />
      <PlanCard x={208} y={51.5} w={68} title="Onboarding" id="TSK-11" who={SM} />

      {/* The teammate's card, carried from To do into Doing. */}
      <g className="fa-f-carry" style={at(0, { '--fx': '-92px', '--fy': '-22px' })}>
        <PlanCard x={116} y={72} w={68} title="Beta invites" id="TSK-16" who={JR} ring={TEAMMATE} />
        <g transform="translate(170 75)">
          <Cursor colour={TEAMMATE} name="JR" />
        </g>
      </g>
    </Stage>
  );
}

/** One card on two boards: carried to Done on the sprint, it moves on the roadmap too. */
export function SharedItemsArt() {
  const boards: {
    x: number;
    name: string;
    other: { title: string; id: string; who: Person; type?: TypeKey };
  }[] = [
    { x: 10, name: 'Sprint 12', other: { title: 'Search', id: 'TSK-20', who: SM } },
    {
      x: 156,
      name: 'Roadmap',
      other: { title: 'Billing', id: 'PRJ-2', who: AK, type: 'project' },
    },
  ];
  return (
    <Stage>
      {boards.map((b) => (
        <g key={b.name}>
          <rect
            className={SURFACE}
            x={b.x}
            y={6}
            width="134"
            height="86"
            rx="5"
            strokeWidth="0.8"
          />
          <text className={INK} x={b.x + 8} y={17} fontSize="7" fontWeight="800" fill="#1e293b">
            {b.name}
          </text>
          {[0, 1].map((i) => (
            <rect
              key={i}
              className={WELL}
              x={b.x + 6 + i * 62}
              y={22}
              width="60"
              height="64"
              rx="3"
              strokeWidth="0.8"
            />
          ))}
          <ColumnHead x={b.x + 10} y={31} name="To do" />
          <ColumnHead x={b.x + 72} y={31} name="Done" />
          <PlanCard
            x={b.x + 9}
            y={58}
            w={54}
            title={b.other.title}
            id={b.other.id}
            who={b.other.who}
            type={b.other.type}
          />
          {/* The same card, TSK-14, on both boards: it moves on both at once. */}
          <g className="fa-f-carry" style={at(0, { '--fx': '-62px' })}>
            <PlanCard
              x={b.x + 71}
              y={36}
              w={54}
              title="Pricing"
              id="TSK-14"
              who={TM}
              ring={TYPE.project}
              type="project"
            />
          </g>
        </g>
      ))}
      {/* The link between them: one item, not a copy. */}
      <g transform="translate(150 47)">
        <circle
          className="fill-violet-100 stroke-violet-400 dark:fill-violet-500/25 dark:stroke-violet-400"
          r="7"
          fill="#ede9fe"
          stroke="#a78bfa"
          strokeWidth="0.8"
        />
        <path
          className="stroke-violet-600 dark:stroke-violet-200"
          d="M-1.2 1.6 L1.6 -1.2 M-0.4 -2.6 L0.6 -3.6 Q2.4 -5.2 4 -3.6 Q5.4 -2 3.8 -0.4 L2.8 0.6 M0.4 2.6 L-0.6 3.6 Q-2.4 5.2 -4 3.6 Q-5.4 2 -3.8 0.4 L-2.8 -0.6"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>
    </Stage>
  );
}

/** A card type of the team's own, Bug, opened on its fields beside the five built-in types. */
export function CardTypesArt() {
  const types: [string, TypeKey][] = [
    ['Project', 'project'],
    ['Task', 'task'],
    ['Note', 'note'],
    ['Idea', 'idea'],
    ['Action', 'action'],
    ['Bug', 'bug'],
  ];
  const fields = ['Priority', 'Due', 'Points', 'Linked card'];
  return (
    <Stage>
      {/* The Card Types panel: the five built in, and Bug, made for this team. */}
      <rect className={SURFACE} x="10" y="6" width="74" height="86" rx="5" strokeWidth="0.8" />
      <text
        className={MUTED}
        x={17}
        y={16.5}
        fontSize="5.6"
        fontWeight="700"
        letterSpacing="0.4"
        fill="#64748b"
      >
        CARD TYPES
      </text>
      {types.map(([name, key], i) => (
        <g key={name}>
          {key === 'bug' ? (
            <rect
              className="fill-rose-50 dark:fill-rose-500/15"
              x={13}
              y={20 + i * 10.5}
              width="68"
              height="9.5"
              rx="2.5"
              fill="#fff1f2"
            />
          ) : null}
          <rect x={17} y={22.3 + i * 10.5} width="5" height="5" rx="1.2" fill={TYPE[key]} />
          <text
            className={INK}
            x={26}
            y={26.8 + i * 10.5}
            fontSize="6.2"
            fontWeight={key === 'bug' ? 700 : 500}
            fill="#1e293b"
          >
            {name}
          </text>
        </g>
      ))}
      <text
        className="fill-sky-600 dark:fill-sky-300"
        x={17}
        y={88}
        fontSize="5.8"
        fontWeight="600"
        fill="#0284c7"
      >
        + New type
      </text>

      {/* The card, opened on its fields. */}
      <rect className={SURFACE} x="92" y="6" width="198" height="86" rx="5" strokeWidth="0.8" />
      <rect x="92" y="6" width="3" height="86" rx="1.5" fill={TYPE.bug} />
      <Pill x={100} y={11} text="Bug" tone="rose" />
      <text className={MUTED} x={123} y={17.6} fontSize="5.6" fontWeight="600" fill="#64748b">
        BUG-21
      </text>
      <Avatar x={279} y={14.5} initials="JR" colour={JR.colour} r={4.2} />
      <text className={INK} x={100} y={31} fontSize="8" fontWeight="800" fill="#1e293b">
        Login fails on Safari
      </text>
      {fields.map((label, i) => (
        <g key={label}>
          <text
            className={MUTED}
            x={100}
            y={46 + i * 12}
            fontSize="6"
            fontWeight="500"
            fill="#64748b"
          >
            {label}
          </text>
          <path
            className="stroke-slate-100 dark:stroke-slate-700"
            d={`M100 ${49.5 + i * 12} H282`}
            stroke="#f1f5f9"
            strokeWidth="0.6"
          />
        </g>
      ))}
      <g className="fa-f-in" style={at(0.3)}>
        <Pill x={146} y={40} text="High" tone="rose" />
      </g>
      <g className="fa-f-in" style={at(0.55)}>
        <rect
          className="stroke-slate-400"
          x={147}
          y={52.2}
          width="6"
          height="5.6"
          rx="1"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="0.7"
        />
        <path className="stroke-slate-400" d="M147 54.2 H153" stroke="#94a3b8" strokeWidth="0.6" />
        <text className={INK} x={156} y={57.6} fontSize="6" fontWeight="600" fill="#1e293b">
          12 Nov
        </text>
      </g>
      <g className="fa-f-in" style={at(0.8)}>
        <Pill x={146} y={64} text="5 pts" tone="neutral" />
      </g>
      <g className="fa-f-in" style={at(1.05)}>
        <rect
          className="fill-sky-50 stroke-sky-200 dark:fill-sky-500/15 dark:stroke-sky-500/40"
          x={146}
          y={75.5}
          width="70"
          height="11"
          rx="2.5"
          fill="#f0f9ff"
          stroke="#bae6fd"
          strokeWidth="0.7"
        />
        <rect x={149} y={78} width="1.8" height="6" rx="0.9" fill={TYPE.task} />
        <text className={INK} x={153.5} y={83} fontSize="5.8" fontWeight="600" fill="#1e293b">
          TSK-9 Auth flow
        </text>
      </g>
    </Stage>
  );
}

/** The Gantt view, drawn from the board's cards, beside the other four views. */
export function PlanViewsArt() {
  const views = ['Gantt', 'Calendar', 'By field', 'Priority', 'Search'];
  const rows: { name: string; x: number; w: number; type: TypeKey; who: Person }[] = [
    { name: 'Research', x: 84, w: 52, type: 'project', who: AK },
    { name: 'Design', x: 118, w: 58, type: 'task', who: JR },
    { name: 'Build', x: 158, w: 80, type: 'task', who: SM },
    { name: 'Launch', x: 232, w: 44, type: 'action', who: TM },
  ];
  return (
    <Stage>
      <rect className={SURFACE} x="10" y="4" width="280" height="88" rx="5" strokeWidth="0.8" />
      {/* The five views; Gantt open. */}
      {views.map((v, i) => {
        const x = 16 + i * 40;
        return (
          <g key={v}>
            {i === 0 ? (
              <rect
                className="fill-sky-100 dark:fill-sky-500/25"
                x={x}
                y={8}
                width="36"
                height="11"
                rx="3"
                fill="#e0f2fe"
              />
            ) : null}
            <text
              className={i === 0 ? 'fill-sky-700 dark:fill-sky-200' : MUTED}
              x={x + 18}
              y={15.6}
              textAnchor="middle"
              fontSize="6"
              fontWeight={i === 0 ? 700 : 500}
              fill={i === 0 ? '#0369a1' : '#64748b'}
            >
              {v}
            </text>
          </g>
        );
      })}
      <path
        className="stroke-slate-100 dark:stroke-slate-700"
        d="M10 23 H290"
        stroke="#f1f5f9"
        strokeWidth="0.8"
      />

      {/* Weeks across the top, a line a week. */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <path
            className="stroke-slate-100 dark:stroke-slate-700/70"
            d={`M${78 + i * 34} 27 V88`}
            stroke="#f1f5f9"
            strokeWidth="0.8"
          />
          <text
            className={MUTED}
            x={95 + i * 34}
            y={33}
            textAnchor="middle"
            fontSize="5.2"
            fontWeight="600"
            fill="#94a3b8"
          >
            {`W${i + 1}`}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = 40 + i * 12.5;
        return (
          <g key={r.name}>
            <rect x={18} y={y + 1} width="2" height="6" rx="1" fill={TYPE[r.type]} />
            <text className={INK} x={24} y={y + 6.6} fontSize="6.2" fontWeight="600" fill="#1e293b">
              {r.name}
            </text>
            <g className="fa-f-grow-x" style={at(0.2 + i * 0.2)}>
              <rect
                x={r.x}
                y={y}
                width={r.w}
                height="8"
                rx="4"
                fill={TYPE[r.type]}
                fillOpacity="0.9"
              />
              <Avatar
                x={r.x + r.w - 4}
                y={y + 4}
                initials={r.who.initials}
                colour={r.who.colour}
                r={3.2}
              />
            </g>
          </g>
        );
      })}
      {/* Today. */}
      <path d="M170 36 V80" stroke={TEAMMATE} strokeWidth="1" strokeDasharray="2 1.6" />
      <rect x={159} y={80} width="22" height="8" rx="4" fill={TEAMMATE} />
      <text x={170} y={85.7} textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#fff">
        Today
      </text>
    </Stage>
  );
}

/** The header widgets: pressing Due Soon narrows the board to the cards due soon. */
export function BoardWidgetsArt() {
  return (
    <Stage>
      {/* Completion: a ring. */}
      <rect className={SURFACE} x="12" y="6" width="66" height="30" rx="4" strokeWidth="0.8" />
      <circle
        className="stroke-slate-100 dark:stroke-slate-700"
        cx="27"
        cy="21"
        r="8"
        fill="none"
        stroke="#f1f5f9"
        strokeWidth="3"
      />
      <circle
        cx="27"
        cy="21"
        r="8"
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${0.68 * 50.3} 50.3`}
        transform="rotate(-90 27 21)"
      />
      <text className={INK} x={40} y={20} fontSize="8.5" fontWeight="800" fill="#1e293b">
        68%
      </text>
      <text className={MUTED} x={40} y={28.5} fontSize="5.6" fontWeight="500" fill="#64748b">
        Completion
      </text>

      {/* Due Soon: pressed. */}
      <rect
        className="fill-amber-50 stroke-amber-400 dark:fill-amber-500/15 dark:stroke-amber-400"
        x="84"
        y="6"
        width="64"
        height="30"
        rx="4"
        fill="#fffbeb"
        stroke={AMBER_RING}
        strokeWidth="1.1"
      />
      <rect
        className="fa-f-ring"
        x="82"
        y="4"
        width="68"
        height="34"
        rx="5.5"
        fill="none"
        stroke={AMBER_RING}
        strokeWidth="0.8"
      />
      <text
        className="fill-amber-600 dark:fill-amber-300"
        x={91}
        y={24.6}
        fontSize="12"
        fontWeight="800"
        fill="#d97706"
      >
        3
      </text>
      <text
        className="fill-amber-800 dark:fill-amber-200"
        x={102}
        y={18}
        fontSize="5.8"
        fontWeight="700"
        fill="#92400e"
      >
        Due soon
      </text>
      <text
        className="fill-amber-700 dark:fill-amber-200/80"
        x={102}
        y={26}
        fontSize="5.2"
        fontWeight="500"
        fill="#b45309"
      >
        this week
      </text>

      {/* WIP Alerts and Top Voted. */}
      <rect className={SURFACE} x="154" y="6" width="64" height="30" rx="4" strokeWidth="0.8" />
      <text
        className="fill-rose-500 dark:fill-rose-300"
        x={161}
        y={24.6}
        fontSize="12"
        fontWeight="800"
        fill="#f43f5e"
      >
        1
      </text>
      <text className={INK} x={171} y={18} fontSize="5.8" fontWeight="700" fill="#1e293b">
        WIP alerts
      </text>
      <text className={MUTED} x={171} y={26} fontSize="5.2" fontWeight="500" fill="#64748b">
        Doing is over
      </text>
      <rect className={SURFACE} x="224" y="6" width="64" height="30" rx="4" strokeWidth="0.8" />
      <circle cx="234" cy="18.5" r="2.4" fill={TEAMMATE} />
      <circle cx="240" cy="18.5" r="2.4" fill={TEAMMATE} />
      <circle cx="237" cy="24" r="2.4" fill={TEAMMATE} />
      <text className={INK} x={247} y={18} fontSize="5.8" fontWeight="700" fill="#1e293b">
        Top voted
      </text>
      <text className={MUTED} x={247} y={26} fontSize="5.2" fontWeight="500" fill="#64748b">
        Dark theme
      </text>

      {/* The board under it: the cards due soon stay, the rest step back. */}
      <PlanCard
        x={12}
        y={46}
        w={66}
        title="Launch post"
        id="TSK-30"
        type="action"
        who={AK}
        ring={AMBER_RING}
      />
      <g className="fa-f-dim">
        <PlanCard x={84} y={46} w={64} title="Billing" id="PRJ-2" type="project" who={SM} />
      </g>
      <PlanCard
        x={154}
        y={46}
        w={64}
        title="Login bug"
        id="BUG-21"
        type="bug"
        who={TM}
        ring={AMBER_RING}
      />
      <g className="fa-f-dim">
        <PlanCard x={224} y={46} w={64} title="Logo" id="IDEA-3" type="idea" who={JR} />
        <PlanCard x={12} y={70} w={66} title="Search" id="TSK-20" who={SM} />
      </g>
      <PlanCard x={84} y={70} w={64} title="Press kit" id="TSK-31" who={JR} ring={AMBER_RING} />
      <g className="fa-f-dim">
        <PlanCard x={154} y={70} w={64} title="Pricing" id="TSK-14" who={AK} />
        <PlanCard x={224} y={70} w={64} title="Docs" id="TSK-9" who={TM} />
      </g>
      <g transform="translate(134 28)">
        <g className="fa-f-in">
          <Cursor colour={YOU} />
        </g>
      </g>
    </Stage>
  );
}

/** A retro: cards face down while the team writes, turned over with Reveal, then voted on. */
export function HiddenVotesArt() {
  const cards = [
    { x: 76, votes: 4, widths: [0.9, 0.7, 0.45], who: AK },
    { x: 146, votes: 2, widths: [0.8, 0.85, 0.3], who: SM },
    { x: 216, votes: 1, widths: [0.95, 0.5], who: JR },
  ];
  return (
    <Stage>
      {/* The column, and its Reveal button pressed. */}
      <text className={INK} x={14} y={18} fontSize="7.4" fontWeight="800" fill="#1e293b">
        Went well
      </text>
      <text className={MUTED} x={14} y={27} fontSize="5.6" fontWeight="500" fill="#64748b">
        Team retro · 3 cards
      </text>
      <rect x={14} y={36} width="44" height="14" rx="4" fill={YOU} />
      <path
        d="M20 43 C 22 40, 26 40, 28 43 C 26 46, 22 46, 20 43 Z"
        fill="none"
        stroke="#fff"
        strokeWidth="0.9"
      />
      <circle cx={24} cy={43} r="1.2" fill="#fff" />
      <text x={31} y={45.2} fontSize="6.2" fontWeight="700" fill="#fff">
        Reveal
      </text>
      <g transform="translate(48 45)">
        <g className="fa-f-in">
          <Cursor colour={YOU} />
        </g>
      </g>

      {cards.map((c, i) => (
        <g key={c.x}>
          {/* The face: the writing, who wrote it and the votes it gathered. */}
          <g className="fa-f-flip-face" style={at(i * 0.12)}>
            <rect
              className={SURFACE}
              x={c.x}
              y={10}
              width="62"
              height="58"
              rx="3.5"
              strokeWidth="0.8"
            />
            <rect x={c.x} y={10} width="62" height="2.6" rx="1.3" fill={TYPE.action} />
            <TextLines
              x={c.x + 6}
              y={20}
              w={50}
              widths={c.widths}
              gap={6}
              h={2.4}
              className={BAR}
            />
            <Avatar x={c.x + 10} y={58} initials={c.who.initials} colour={c.who.colour} r={3.8} />
            {Array.from({ length: c.votes }, (_, d) => (
              <circle key={d} cx={c.x + 54 - d * 6.2} cy={58} r="2.4" fill={TEAMMATE} />
            ))}
          </g>
          {/* The back, while the writing is hidden. */}
          <g className="fa-f-flip-back" style={at(i * 0.12)}>
            <rect x={c.x} y={10} width="62" height="58" rx="3.5" fill={YOU} />
            <rect
              x={c.x + 4}
              y={14}
              width="54"
              height="50"
              rx="2.5"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.4"
              strokeWidth="0.8"
            />
            <path
              d={`M${c.x + 22} 39 C ${c.x + 25} 34, ${c.x + 37} 34, ${c.x + 40} 39 C ${c.x + 37} 44, ${c.x + 25} 44, ${c.x + 22} 39 Z M${c.x + 21} 46 L${c.x + 41} 32`}
              fill="none"
              stroke="#fff"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </g>
        </g>
      ))}
      <g className="fa-f-on">
        <Pill x={76} y={76} text="Revealed: now vote for what matters most" tone="brand" w={202} />
      </g>
    </Stage>
  );
}
