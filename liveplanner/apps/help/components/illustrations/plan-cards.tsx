// Plan mode's card scenes (docs/specs/026-plan/), re-exported from ./plan: the card panel, the card menu,
// the Card Types panel, one item on two boards and a card's threads. Composed from the shared primitives so
// the house style holds.

import {
  Scene,
  Panel,
  Label,
  TextBar,
  Cursor,
  Menu,
  Tabs,
} from '@liveworkspace/help-site/art/primitives';
import { type CardType, STRIPE, Card } from './plan-parts';

/** The card panel: the back bar to the card before, then the type and number, the ⋯ menu and close;
 *  the title over the card's tabs with Linked Cards open on Linked as Parent; Details on the right. */
export function PlanCardPanelScene() {
  return (
    <Scene w={420} h={260} bg="plain">
      <rect
        x={10}
        y={10}
        width={400}
        height={240}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* The breadcrumb: the back bar to the card before, this card's number as its chip. */}
      <rect
        x={18}
        y={14}
        width={384}
        height={20}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={22} y={17} width={14} height={14} rx={3} className="fill-slate-100" />
      <Label x={29} y={25} size={10} anchor="middle" weight={700} tone="muted">
        ‹
      </Label>
      <Label x={42} y={25} size={10} weight={700} tone="body">
        #2 Launch
      </Label>
      <rect x={370} y={17} width={28} height={14} rx={3} className="fill-slate-100" />
      <Label x={384} y={25} size={9} anchor="middle" weight={700} tone="muted">
        #11
      </Label>
      {/* Header. */}
      <rect x={20} y={38} width={4} height={12} rx={1.5} className={STRIPE.task} />
      <Label x={28} y={45} size={11} weight={700} tone="strong">
        Task
      </Label>
      <Label x={58} y={45} size={11} tone="muted">
        #11
      </Label>
      {/* Help lives inside the ⋯ menu, not on the header. */}
      <Label x={368} y={44} size={13} anchor="middle" weight={700} tone="muted">
        ⋯
      </Label>
      <Label x={394} y={45} size={12} anchor="middle" tone="muted">
        ✕
      </Label>
      <line x1={10} y1={53} x2={410} y2={53} className="stroke-slate-200" strokeWidth={1.5} />

      {/* Main column. */}
      <Label x={24} y={62} size={14} weight={700} tone="strong">
        New icons
      </Label>
      <Tabs
        x={22}
        y={76}
        items={['Overview', 'Linked Cards', 'Activity']}
        active={1}
        tabW={80}
        h={20}
      />
      <Label x={24} y={118} size={10} weight={700} tone="body">
        Linked as Parent 2
      </Label>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect
            x={22}
            y={128 + i * 26}
            width={240}
            height={22}
            rx={5}
            className="fill-slate-50 stroke-slate-200"
            strokeWidth={1}
          />
          <rect x={26} y={133 + i * 26} width={3} height={12} rx={1} className={STRIPE.task} />
          <Label x={34} y={139 + i * 26} size={10} tone="muted">
            {i ? '#17' : '#16'}
          </Label>
          <Label x={58} y={139 + i * 26} size={10} tone="strong">
            {i ? 'Export set' : 'Draw glyphs'}
          </Label>
          <Label x={256} y={139 + i * 26} size={10} anchor="end" tone="muted">
            {i ? 'To Do' : 'In Progress'}
          </Label>
        </g>
      ))}
      <Label x={28} y={194} size={10} weight={600} tone="accent">
        + New Task
      </Label>
      <Label x={96} y={194} size={10} weight={600} tone="accent">
        Link Existing
      </Label>

      {/* Details. */}
      <rect x={278} y={52} width={124} height={190} rx={8} className="fill-slate-50" />
      <Label x={288} y={66} size={10} weight={700} tone="body">
        Details
      </Label>
      {[
        ['Status', 'In Progress'],
        ['Assignee', 'Sam'],
        ['Parent', '#2 Launch'],
        ['Priority', 'High'],
        ['Due', '14 Oct'],
      ].map(([k, v], i) => (
        <g key={k}>
          <Label x={288} y={88 + i * 22} size={10} tone="muted">
            {k}
          </Label>
          <Label x={340} y={88 + i * 22} size={10} tone="strong">
            {v}
          </Label>
        </g>
      ))}
      <line x1={288} y1={202} x2={394} y2={202} className="stroke-slate-200" />
      <Label x={288} y={216} size={10} tone="muted">
        Created by Sam
      </Label>
      <Label x={288} y={230} size={10} tone="muted">
        Last edited by Alex
      </Label>
    </Scene>
  );
}

/** Right-clicking a card: Open, Duplicate, Edit Card Type, a Move to row per column, Select, Flag,
 *  Archive, Trash. */
export function PlanCardMenuScene() {
  return (
    <Scene w={420} h={264}>
      <rect
        x={20}
        y={20}
        width={110}
        height={224}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
      />
      <Label x={30} y={36} size={11} weight={700} tone="strong">
        To Do
      </Label>
      <Card x={28} y={52} type="task" num={14} title="Write docs" w={94} />
      <Card x={28} y={88} type="action" num={15} title="Pick a date" w={94} />
      <Cursor x={96} y={70} />
      <Menu
        x={150}
        y={20}
        w={180}
        rowH={21}
        active={1}
        items={[
          'Write docs',
          'Open',
          'Duplicate',
          'Edit Card Type',
          'Move to In Progress',
          'Move to Review',
          'Select',
          'Flag',
          'Archive',
          'Trash',
        ]}
      />
      {/* The menu's header (the card's title), separators between its groups, and Trash at the end. */}
      <rect x={154} y={24} width={172} height={21} rx={5} className="fill-white" />
      <Label x={162} y={35} size={10} weight={700} tone="muted">
        Write docs
      </Label>
      <line x1={156} y1={45} x2={324} y2={45} className="stroke-slate-200" />
      <line x1={156} y1={108} x2={324} y2={108} className="stroke-slate-200" />
      <line x1={156} y1={150} x2={324} y2={150} className="stroke-slate-200" />
      <line x1={156} y1={171} x2={324} y2={171} className="stroke-slate-200" />
      <rect x={154} y={213} width={172} height={21} rx={5} className="fill-white" />
      <Label x={162} y={224} size={11} tone="body">
        Trash
      </Label>
    </Scene>
  );
}

/** The Card Types panel above its button: a row per type (its stripe, glyph tile, name and how many
 *  fields, then Duplicate and the pencil), then Add Card Type. */
export function PlanCardTypesScene() {
  const rows: { type: CardType; name: string; fields: string }[] = [
    { type: 'project', name: 'Project', fields: '8 fields' },
    { type: 'task', name: 'Task', fields: '11 fields, 2 custom' },
    { type: 'note', name: 'Note', fields: '5 fields' },
    { type: 'idea', name: 'Idea', fields: '6 fields' },
    { type: 'action', name: 'Action', fields: '7 fields' },
  ];
  const ink = { fill: 'none', className: 'stroke-slate-400', strokeWidth: 1.3 } as const;
  return (
    <Scene w={420} h={270}>
      <Panel x={120} y={8} w={200} h={226} title="CARD TYPES">
        {rows.map((r, i) => {
          const y = 38 + i * 30;
          return (
            <g key={r.name}>
              <rect
                x={130}
                y={y}
                width={180}
                height={26}
                rx={6}
                className="fill-white stroke-slate-200"
                strokeWidth={1}
              />
              <rect x={130} y={y} width={3.5} height={26} rx={1.5} className={STRIPE[r.type]} />
              {/* The type's glyph tile, tinted in its colour. */}
              <rect x={139} y={y + 5} width={16} height={16} rx={4} className="fill-slate-100" />
              <rect x={144} y={y + 10} width={6} height={6} rx={1.5} className={STRIPE[r.type]} />
              <Label x={161} y={y + 9} size={10} weight={600} tone="strong">
                {r.name}
              </Label>
              <Label x={161} y={y + 20} size={9} tone="muted">
                {r.fields}
              </Label>
              {/* Duplicate, then the pencil. */}
              <rect x={273} y={y + 9} width={7} height={7} rx={1.5} {...ink} />
              <rect x={276} y={y + 6} width={7} height={7} rx={1.5} {...ink} />
              <path d={`M292 ${y + 18} l2 -0.5 l7 -7 l-1.5 -1.5 l-7 7 Z`} {...ink} />
            </g>
          );
        })}
        <rect
          x={130}
          y={190}
          width={180}
          height={22}
          rx={6}
          fill="none"
          className="stroke-slate-300"
          strokeDasharray="4 3"
        />
        <Label x={220} y={201} size={11} weight={600} anchor="middle" tone="accent">
          + Add Card Type
        </Label>
      </Panel>
      {/* Its button, in the bottom-right cluster. */}
      <rect
        x={203}
        y={240}
        width={34}
        height={26}
        rx={8}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1.5}
      />
      <rect
        x={213}
        y={246}
        width={14}
        height={14}
        rx={2.5}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.6}
      />
      <rect x={213} y={246} width={3.5} height={14} rx={1.5} className="fill-brand-500" />
    </Scene>
  );
}

/** One item, two boards: the same card on a Sprint board and on a Roadmap, so moving it on one moves it
 *  on the other. */
export function PlanItemTwoBoardsScene() {
  const board = (x: number, title: string, cols: string[], at: number) => (
    <g>
      <rect
        x={x}
        y={20}
        width={170}
        height={150}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={x + 10} y={36} size={11} weight={700} tone="strong">
        {title}
      </Label>
      {cols.map((c, i) => {
        const cx = x + 8 + i * 54;
        return (
          <g key={c}>
            <rect x={cx} y={48} width={50} height={114} rx={6} className="fill-slate-50" />
            <Label x={cx + 5} y={58} size={10} weight={600} tone="body">
              {c}
            </Label>
            {i === at && (
              <g>
                <rect
                  x={cx + 3}
                  y={70}
                  width={44}
                  height={28}
                  rx={4}
                  className="fill-white stroke-brand-400"
                  strokeWidth={1.5}
                />
                <rect x={cx + 3} y={70} width={3} height={28} rx={1} className={STRIPE.task} />
                <Label x={cx + 10} y={84} size={10} weight={600} tone="strong">
                  #12
                </Label>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
  return (
    <Scene w={420} h={230}>
      {board(20, 'Sprint', ['To Do', 'Doing', 'Done'], 1)}
      {board(230, 'Standup', ['Doing', 'Blocked', 'Done'], 0)}
      <path
        d="M128 84 C 170 130, 200 130, 240 84"
        fill="none"
        className="stroke-brand-300"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <rect
        x={140}
        y={188}
        width={140}
        height={30}
        rx={8}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.5}
      />
      <Label x={210} y={203} size={11} weight={600} anchor="middle" tone="accent">
        Item #12, one record
      </Label>
      <path d="M210 188 V 118" className="stroke-brand-300" strokeWidth={1.5} />
    </Scene>
  );
}

/** A card's comment threads (ItemPanel's Comments, CardThreads): the tally and New Thread, an open thread with its
 *  people, comment count, last activity and the link chip of a thread on three cards, another open thread, and the
 *  Resolved disclosure under them. */
export function PlanCardThreadsScene() {
  const faces = (x: number, y: number, fills: string[]) =>
    fills.map((fill, i) => (
      <circle
        key={i}
        cx={x + i * 9}
        cy={y}
        r={5.5}
        className={`${fill} stroke-white`}
        strokeWidth={1.5}
      />
    ));
  const tile = (
    y: number,
    title: string,
    meta: string,
    fills: string[],
    opts: { shared?: boolean; open?: boolean } = {},
  ) => (
    <g>
      <rect
        x={20}
        y={y}
        width={380}
        height={opts.open ? 104 : 42}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <circle cx={36} cy={y + 15} r={7} className="fill-brand-50" />
      <rect x={32} y={y + 11} width={8} height={7} rx={2} className="fill-brand-500" />
      <Label x={50} y={y + 16} size={10.5} weight={700} tone="strong">
        {title}
      </Label>
      {faces(54, y + 30, fills)}
      <Label x={58 + fills.length * 9} y={y + 31} size={9} tone="muted">
        {meta}
      </Label>
      {opts.shared ? (
        <g>
          <rect x={318} y={y + 7} width={42} height={16} rx={8} className="fill-amber-50" />
          <Label x={339} y={y + 16} size={9} anchor="middle" weight={600} tone="body">
            3 cards
          </Label>
        </g>
      ) : null}
      <Label x={386} y={y + 16} size={11} anchor="middle" tone="muted">
        ⋯
      </Label>
      {opts.open ? (
        <g>
          <line x1={20} y1={y + 44} x2={400} y2={y + 44} className="stroke-slate-100" />
          <circle cx={38} cy={y + 60} r={7} className="fill-orange-500" />
          <Label x={52} y={y + 58} size={9} weight={600} tone="strong">
            Ada King
          </Label>
          <TextBar x={52} y={y + 64} w={230} />
          <rect
            x={40}
            y={y + 78}
            width={290}
            height={18}
            rx={5}
            className="fill-white stroke-slate-200"
          />
          <Label x={48} y={y + 88} size={9} tone="muted">
            Reply…
          </Label>
          <Label x={390} y={y + 88} size={9} anchor="end" weight={600} tone="accent">
            ✓ Resolve
          </Label>
        </g>
      ) : null}
    </g>
  );
  return (
    <Scene w={420} h={248}>
      <Label x={20} y={22} size={12} weight={700} tone="strong">
        Comments
      </Label>
      <Label x={20} y={40} size={10} tone="muted">
        2 open · 1 resolved
      </Label>
      <Label x={400} y={40} size={10} anchor="end" weight={600} tone="accent">
        + New Thread
      </Label>
      {tile(
        52,
        'Promo code vs free items',
        '4 comments · 2h ago',
        ['fill-emerald-500', 'fill-orange-500', 'fill-violet-500'],
        {
          shared: true,
          open: true,
        },
      )}
      {tile(164, 'Bo Lindqvist: Copy for the empty basket…', '2 comments · 1d ago', [
        'fill-green-600',
      ])}
      <Label x={20} y={230} size={10} weight={600} tone="muted">
        › Resolved · 1
      </Label>
    </Scene>
  );
}
