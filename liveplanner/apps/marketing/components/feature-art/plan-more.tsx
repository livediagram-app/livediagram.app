// Feature illustrations for the Plan cards beyond the board (docs/specs/026-plan/item-types.md): a card's
// own panel with its detail, the conversation on a card, finding any card with filters, and a board
// going out and coming in as CSV. Built from the board's own card and people (./plan-parts).

import {
  Caret,
  HAIRLINE,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Avatar, Pill } from './mode-parts';
import { AK, ColumnHead, JR, PlanCard, SM, TM, TYPE } from './plan-parts';
import { Frame, MONO } from '@liveworkspace/marketing-site/components/feature-art/shared';

// A card's panel: the title over its description and a checklist ticking towards done, and Details
// down the right (status, assignee, priority, labels, due), a red flag by the number and the
// breadcrumb back to its project.
export function CardDetailArt() {
  const steps = [
    { text: 'Draft the copy', done: true },
    { text: 'Review with legal', done: true },
    { text: 'Schedule the post', done: false },
  ];
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="14" y="5" width="272" height="86" rx="5" strokeWidth="0.8" />
        </g>
        {/* The breadcrumb, the type and number, and the flag. */}
        <text className={TEXT_MUTED} x="22" y="15" fontSize="5">
          Launch site ›
        </text>
        <rect x="58" y="10" width="2.2" height="6.5" rx="1" fill={TYPE.task} />
        <text className={TEXT_MUTED} x="62.5" y="15" fontSize="5" fontWeight="600">
          Task · #42
        </text>
        <path
          d="M91 10.2 v6 M91 10.6 h5 l-1.4 1.6 l1.4 1.6 h-5"
          stroke="#ef4444"
          fill="#ef4444"
          strokeWidth="0.8"
        />
        <text className={TEXT_STRONG} x="22" y="28" fontSize="8" fontWeight="700">
          Announce the launch
        </text>
        <text className={TEXT_BODY} x="22" y="38" fontSize="5.4">
          Post on <tspan fontWeight="700">Tuesday</tspan>, with the new screenshots.
        </text>
        {/* The checklist and its progress. */}
        <text className={TEXT_MUTED} x="22" y="50" fontSize="5" fontWeight="700">
          CHECKLIST · 2 OF 3
        </text>
        <rect
          className="fill-slate-100 dark:fill-slate-700"
          x="82"
          y="46.6"
          width="74"
          height="3"
          rx="1.5"
        />
        <rect className="fill-emerald-500" x="82" y="46.6" width="49" height="3" rx="1.5" />
        {steps.map((s, i) => (
          <g key={s.text}>
            <rect
              x="22"
              y={55 + i * 10}
              width="6"
              height="6"
              rx="1.4"
              className={
                s.done
                  ? 'fill-emerald-500'
                  : 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500'
              }
              strokeWidth="0.8"
            />
            {s.done ? (
              <path
                d={`M23.5 ${58 + i * 10} l1.4 1.4 l2.4 -2.6`}
                stroke="#fff"
                strokeWidth="0.9"
                fill="none"
              />
            ) : null}
            <text
              className={s.done ? TEXT_MUTED : TEXT_BODY}
              x="32"
              y={60 + i * 10}
              fontSize="5.4"
              textDecoration={s.done ? 'line-through' : undefined}
            >
              {s.text}
            </text>
          </g>
        ))}
        <g className="fa-d-ring">
          <rect
            className="fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
            x="20"
            y="73"
            width="70"
            height="10"
            rx="2"
            strokeWidth="0.8"
          />
        </g>
        {/* Details. */}
        <line className={HAIRLINE} x1="172" x2="172" y1="22" y2="86" strokeWidth="0.8" />
        {[
          ['Status', <Pill key="s" x={212} y={22} text="In Progress" tone="brand" />],
          [
            'Assignee',
            <Avatar key="a" x={216} y={40.5} initials={SM.initials} colour={SM.colour} r={3.8} />,
          ],
          ['Priority', <Pill key="p" x={212} y={49} text="High" tone="rose" />],
          ['Labels', <Pill key="l" x={212} y={62} text="marketing" tone="amber" />],
          ['Due', null],
        ].map(([label, value], i) => (
          <g key={label as string}>
            <text className={TEXT_MUTED} x="180" y={28.5 + i * 13} fontSize="5.2">
              {label}
            </text>
            {value}
          </g>
        ))}
        <text className={TEXT_STRONG} x="212" y="80.5" fontSize="5.4" fontWeight="600">
          Tue 14 Oct
        </text>
      </Scene>
    </Frame>
  );
}

// The conversation on a card: two comments under it, an @mention of a teammate highlighted, and a
// reply being typed, the count shown on the card on the board beside.
export function CardCommentsArt() {
  return (
    <Frame canvas>
      <Scene>
        {/* The card on the board, with its comment count. */}
        <ColumnHead x={16} y={18} name="Review" count="2" />
        <PlanCard x={14} y={24} w={78} title="Pricing page" id="#18" who={AK} />
        <PlanCard
          x={14}
          y={48}
          w={78}
          title="Hero copy"
          id="#21"
          type="idea"
          who={JR}
          ring="#8b5cf6"
        />
        <g>
          <path
            className="fill-slate-400"
            d="M60 60 h7 a1.4 1.4 0 0 1 1.4 1.4 v3.6 a1.4 1.4 0 0 1 -1.4 1.4 h-4 l-2.2 1.8 v-1.8 h-0.8 a1.4 1.4 0 0 1 -1.4 -1.4 v-3.6 a1.4 1.4 0 0 1 1.4 -1.4z"
          />
          <text className={TEXT_MUTED} x="71" y="66" fontSize="5" fontWeight="600">
            3
          </text>
        </g>
        {/* The thread, in the card's panel. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="106" y="6" width="182" height="84" rx="5" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="114" y="17" fontSize="6.4" fontWeight="700">
          Hero copy
        </text>
        <text className={TEXT_MUTED} x="280" y="17" fontSize="5" textAnchor="end">
          Resolve
        </text>
        {[
          { who: JR, y: 30, line: ['Shorter? This runs to two lines', ''] },
          { who: TM, y: 50, line: ['', 'can you check it on a phone?'], mention: '@Sam ' },
        ].map((c) => (
          <g key={c.y}>
            <Avatar x={118} y={c.y - 2} initials={c.who.initials} colour={c.who.colour} r={4} />
            <text className={TEXT_BODY} x="126" y={c.y} fontSize="5.6">
              {c.mention ? (
                <tspan className="fill-brand-700 dark:fill-brand-300" fontWeight="700">
                  {c.mention}
                </tspan>
              ) : null}
              {c.line[0] || c.line[1]}
            </text>
          </g>
        ))}
        {/* The reply box. */}
        <rect
          className="fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
          x="114"
          y="64"
          width="166"
          height="18"
          rx="3"
          strokeWidth="0.8"
        />
        <text className={TEXT_BODY} x="120" y="75" fontSize="5.6">
          Looks good on mine
        </text>
        <Caret x={170} y={69} h={8} />
        <rect className="fill-brand-700" x="248" y="68" width="28" height="10" rx="2.5" />
        <text x="262" y="74.8" fontSize="5" fontWeight="700" fill="#fff" textAnchor="middle">
          Reply
        </text>
      </Scene>
    </Frame>
  );
}

// Finding a card: the Cards list searched by words with two filters in the box (a card type and a
// state), the matching cards listed newest change first.
export function FindCardArt() {
  const rows = [
    { id: '#57', title: 'Login fails on Safari', type: 'bug' as const, who: AK },
    { id: '#49', title: 'Logout button hidden', type: 'bug' as const, who: SM },
    { id: '#33', title: 'Login rate limit', type: 'bug' as const, who: JR },
  ];
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="40" y="6" width="220" height="84" rx="5" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="48" y="17" fontSize="6.4" fontWeight="700">
          Cards
        </text>
        {/* The search box with its filters. */}
        <rect
          className="fill-slate-50 stroke-brand-500 dark:fill-slate-900 dark:stroke-brand-400"
          x="48"
          y="22"
          width="204"
          height="14"
          rx="3"
          strokeWidth="0.9"
        />
        <Pill x={52} y={24.5} text="Type: Bug" tone="rose" />
        <Pill x={96} y={24.5} text="State: Open" tone="emerald" />
        <text className={TEXT_STRONG} x="152" y="31.6" fontSize="6">
          log
        </text>
        <Caret x={162} y={25} h={8} />
        <text
          className="fill-brand-700 dark:fill-brand-300"
          x="248"
          y="31.4"
          fontSize="5"
          fontWeight="700"
          textAnchor="end"
        >
          + Add Filter
        </text>
        {rows.map((r, i) => (
          <g key={r.id} className="fa-d-land" style={{ animationDelay: `${0.2 * i}s` }}>
            <rect x="48" y={41 + i * 15} width="2.2" height="12" rx="1" fill={TYPE[r.type]} />
            <text className={TEXT_MUTED} x="54" y={49 + i * 15} fontSize="5.2" fontWeight="600">
              {r.id}
            </text>
            <text className={TEXT_STRONG} x="68" y={49 + i * 15} fontSize="5.8">
              {r.title}
            </text>
            <Avatar
              x={246}
              y={47 + i * 15}
              initials={r.who.initials}
              colour={r.who.colour}
              r={3.6}
            />
          </g>
        ))}
      </Scene>
    </Frame>
  );
}

// A board in and out as CSV: the file's rows on the left (Title, Status, Assignee), each landing as a
// card in the column its Status names.
export function BoardCsvArt() {
  const csv = [
    'Title,Status,Assignee',
    'Fix footer,To do,Sam',
    'New logo,Doing,Ana',
    'Alt text,To do,Jo',
  ];
  return (
    <Frame canvas>
      <Scene>
        <g className={SHADOW}>
          <rect className={PANEL} x="10" y="10" width="112" height="70" rx="4" strokeWidth="0.8" />
        </g>
        <text className={TEXT_MUTED} x="17" y="20" fontSize="5" fontWeight="700">
          backlog.csv
        </text>
        <line className={HAIRLINE} x1="10" x2="122" y1="24" y2="24" strokeWidth="0.8" />
        {csv.map((line, i) => (
          <text
            key={line}
            className={i === 0 ? TEXT_STRONG : TEXT_BODY}
            x="17"
            y={35 + i * 11}
            fontSize="5.6"
            fontFamily={MONO}
            fontWeight={i === 0 ? 700 : 400}
          >
            {line}
          </text>
        ))}
        <path className="stroke-(--art-arrow)" d="M128 45 H146" strokeWidth="1.1" />
        <path className="fill-(--art-arrow)" d="M150 45 l-5 -3 v6z" />
        <ColumnHead x={158} y={14} name="To do" count="2" />
        <ColumnHead x={226} y={14} name="Doing" count="1" />
        <g className="fa-d-land">
          <PlanCard x={156} y={20} w={62} title="Fix footer" id="#61" who={SM} />
        </g>
        <g className="fa-d-land" style={{ animationDelay: '0.4s' }}>
          <PlanCard x={156} y={43} w={62} title="Alt text" id="#63" who={JR} />
        </g>
        <g className="fa-d-land" style={{ animationDelay: '0.2s' }}>
          <PlanCard x={224} y={20} w={62} title="New logo" id="#62" type="idea" who={AK} />
        </g>
        <text className={TEXT_MUTED} x="156" y="80" fontSize="5">
          Import: CSV, Trello, Jira · Export: CSV, PNG, PDF
        </text>
      </Scene>
    </Frame>
  );
}

// Several cards changed at once: two cards picked on a board (ringed in the brand colour), the
// selection bar over the board naming the count and its actions, and the pair being dragged as one
// stack with its count badge into the next column.
export function SelectCardsArt() {
  const RING = '#8b5cf6';
  // Each action's pill sits 4 after the last, at the width Pill gives its text.
  let at = 80;
  const actions = ['Move To', 'Assign', 'Priority', 'Labels', 'Flag'].map((text) => {
    const x = at;
    at += text.length * 3.9 + 12;
    return { text, x };
  });
  return (
    <Frame canvas>
      <Scene>
        {/* The selection bar: the count, then the actions, then Clear Selection. */}
        <rect
          className="fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
          x="14"
          y="4"
          width="272"
          height="14"
          rx="3"
          strokeWidth="0.8"
        />
        <text
          className="fill-brand-700 dark:fill-brand-300"
          x="20"
          y="13"
          fontSize="5.6"
          fontWeight="700"
        >
          2 cards selected
        </text>
        {actions.map((a, i) => (
          <Pill key={a.text} x={a.x} y={6.5} text={a.text} tone={i === 0 ? 'brand' : 'neutral'} />
        ))}
        <path
          className="stroke-slate-400"
          d="M276.5 8.5l4 4M280.5 8.5l-4 4"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        {/* The board: three columns, two cards picked in the first. */}
        <ColumnHead x={16} y={28} name="Triage" count="3" />
        <ColumnHead x={112} y={28} name="This Week" count="1" />
        <ColumnHead x={208} y={28} name="Done" count="2" />
        <PlanCard
          x={14}
          y={33}
          w={84}
          title="Login fails"
          id="#57"
          type="bug"
          who={AK}
          ring={RING}
        />
        <PlanCard x={14} y={54} w={84} title="Slow search" id="#58" type="bug" who={SM} />
        <PlanCard
          x={14}
          y={75}
          w={84}
          title="Broken link"
          id="#60"
          type="bug"
          who={JR}
          ring={RING}
        />
        <PlanCard x={110} y={33} w={84} title="Pricing page" id="#18" who={TM} />
        <PlanCard x={206} y={33} w={84} title="New logo" id="#12" type="idea" who={AK} />
        <PlanCard x={206} y={54} w={84} title="Alt text" id="#14" who={SM} />
        {/* The pair, dragged as one stack with its count, landing in This Week. */}
        <g className="fa-d-land">
          <rect
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
            x="113"
            y="57"
            width="84"
            height="19"
            rx="2.5"
            strokeWidth="0.8"
          />
          <PlanCard
            x={110}
            y={54}
            w={84}
            title="Login fails"
            id="#57"
            type="bug"
            who={AK}
            ring={RING}
          />
          <circle cx="194" cy="54" r="4.6" fill={RING} />
          <text x="194" y="56" fontSize="5.4" fontWeight="700" fill="#fff" textAnchor="middle">
            2
          </text>
        </g>
      </Scene>
    </Frame>
  );
}
