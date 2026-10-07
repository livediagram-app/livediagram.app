// Plan mode illustrations (docs/specs/026-plan/): a board with its header widgets and columns, the
// bottom-right cluster Plan mode brings, a column's cog, the board picker, the card panel, the card menu,
// the Card Types panel and one item on two boards. Composed from the shared primitives so the house style
// holds; the labels are the editor's own (PlanColumnPopover, ItemPanel, PlanCardMenu, CardTypesPanel...).

import type { ReactNode } from 'react';
import { Scene, Panel, Button, Label, TextBar, Cursor, Menu, Tabs } from './primitives';

// The five built-in card types' stripes: Project black, Task gray, Note blue, Idea yellow, Action red.
type CardType = 'project' | 'task' | 'note' | 'idea' | 'action';
const STRIPE: Record<CardType, string> = {
  project: 'fill-slate-800',
  task: 'fill-slate-400',
  note: 'fill-indigo-500',
  idea: 'fill-amber-400',
  action: 'fill-rose-500',
};

/** One card on a board: the type's stripe, its number and its title. */
function Card({
  x,
  y,
  w = 80,
  h = 30,
  type = 'task',
  num,
  title,
  muted = false,
  lifted = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  type?: CardType;
  num: number;
  title: string;
  muted?: boolean;
  lifted?: boolean;
}) {
  return (
    <g transform={lifted ? `rotate(-4 ${x + w / 2} ${y + h / 2})` : undefined}>
      {lifted && (
        <rect x={x + 2} y={y + 3} width={w} height={h} rx={5} className="fill-slate-900/10" />
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className={lifted ? 'fill-white stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={lifted ? 1.5 : 1}
      />
      <rect x={x} y={y} width={3.5} height={h} rx={1.5} className={STRIPE[type]} />
      <Label x={x + 9} y={y + 10} size={10} tone="muted">
        #{num}
      </Label>
      <Label x={x + 9} y={y + 22} size={10} tone={muted ? 'muted' : 'strong'} weight={500}>
        {title}
      </Label>
    </g>
  );
}

/** A small widget pill in a board's header. */
function Widget({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={18}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={x + w / 2} y={y + 10} size={10} anchor="middle" tone="body">
        {label}
      </Label>
    </g>
  );
}

/** A column's cog. */
function Cog({ cx, cy, on = false }: { cx: number; cy: number; on?: boolean }) {
  return (
    <g>
      {on && <circle cx={cx} cy={cy} r={8} className="fill-brand-100" />}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="none"
        className={on ? 'stroke-brand-600' : 'stroke-slate-400'}
        strokeWidth={1.6}
      />
      <path
        d={`M${cx} ${cy - 6.5} v2 M${cx} ${cy + 4.5} v2 M${cx - 6.5} ${cy} h2 M${cx + 4.5} ${cy} h2`}
        className={on ? 'stroke-brand-600' : 'stroke-slate-400'}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A column well with its head: name, count, and an optional cog. */
function Column({
  x,
  y,
  w,
  h,
  name,
  count,
  warn = false,
  cog = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  count: string;
  warn?: boolean;
  cog?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} className="fill-slate-50" />
      <Label x={x + 7} y={y + 12} size={10} weight={700} tone="strong">
        {name}
      </Label>
      <Label
        x={x + w - (cog ? 18 : 7)}
        y={y + 12}
        size={10}
        anchor="end"
        weight={warn ? 700 : 400}
        className={warn ? 'fill-amber-500' : 'fill-slate-400'}
      >
        {count}
      </Label>
      {cog && <Cog cx={x + w - 8} cy={y + 12} on />}
    </g>
  );
}

/** A Kanban board in Plan mode: header widgets, a column over its WIP limit with its cog, cards with
 *  their type stripes, a card being dragged into the gap it opens, and + Add card. */
export function PlanBoardScene() {
  const colW = 124;
  const xs = [18, 148, 278];
  const cw = 110;
  return (
    <Scene w={420} h={250}>
      <rect
        x={8}
        y={8}
        width={404}
        height={234}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* Header: title, widgets, then the + that opens the palette's Widgets. */}
      <Label x={20} y={25} size={13} weight={700} tone="strong">
        Kanban
      </Label>
      <Widget x={80} y={16} w={66} label="6 items" />
      <Widget x={152} y={16} w={74} label="Completion" />
      <Widget x={232} y={16} w={74} label="WIP Alerts" />
      <rect
        x={312}
        y={16}
        width={18}
        height={18}
        rx={5}
        fill="none"
        className="stroke-slate-300"
        strokeDasharray="3 2"
      />
      <Label x={321} y={26} size={12} anchor="middle" tone="muted">
        +
      </Label>

      <Column x={xs[0]!} y={44} w={colW} h={190} name="To do" count="2" />
      <Column x={xs[1]!} y={44} w={colW} h={190} name="In progress" count="3 / 3" warn cog />
      <Column x={xs[2]!} y={44} w={colW} h={190} name="Review" count="1" />

      {/* To do: one card left, its neighbour is on its way to Review. */}
      <Card x={xs[0]! + 7} y={66} w={cw} type="action" num={15} title="Pick a date" />
      <Label x={xs[0]! + 11} y={110} size={10} tone="muted">
        + Add card
      </Label>

      <Card x={xs[1]! + 7} y={66} w={cw} type="task" num={9} title="Fix login" />
      <Card x={xs[1]! + 7} y={102} w={cw} type="task" num={11} title="New icons" />
      <Card x={xs[1]! + 7} y={138} w={cw} type="project" num={2} title="Launch" />

      <Card x={xs[2]! + 7} y={66} w={cw} type="note" num={8} title="Copy check" />
      {/* The gap the dragged card opens where it will land. */}
      <rect
        x={xs[2]! + 7}
        y={102}
        width={cw}
        height={30}
        rx={5}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {/* The card on the move, lifted under the pointer. */}
      <Card x={240} y={178} w={cw} type="task" num={14} title="Write docs" lifted />
      <Cursor x={330} y={198} />
    </Scene>
  );
}

/** Small icon-only cluster button. */
function ClusterButton({
  x,
  y,
  label,
  children,
}: {
  x: number;
  y: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={34}
        height={34}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <g transform={`translate(${x + 17} ${y + 17})`}>{children}</g>
      <Label x={x + 17} y={y + 48} size={10} anchor="middle" tone="muted">
        {label}
      </Label>
    </g>
  );
}

/** Plan mode's bottom-right cluster: the Trash (with its count) left of Undo and Redo, then Cards and
 *  Card Types where Layers sits in the other modes, then Theme and the zoom controls. */
export function PlanClusterScene() {
  const ink = 'stroke-slate-600';
  return (
    <Scene w={420} h={130} bg="canvas">
      {/* Trash, with its count badge. */}
      <ClusterButton x={14} y={44} label="Trash">
        <path
          d="M-7 -5 h14 M-3 -5 v-2 h6 v2 M-5 -5 l1 12 h8 l1 -12"
          fill="none"
          className={ink}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </ClusterButton>
      <g className="help-art-as-drawn">
        <circle cx={46} cy={44} r={8} className="fill-rose-500" />
        <Label x={46} y={45} size={10} anchor="middle" weight={700} tone="onAccent">
          2
        </Label>
      </g>

      {/* Undo / Redo strip. */}
      <rect
        x={58}
        y={44}
        width={68}
        height={34}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={92} y1={50} x2={92} y2={72} className="stroke-slate-200" strokeWidth={1.5} />
      <path
        d="M81 58 h-8 l4 -4 M73 58 l4 4 M73 58 h6 a6 6 0 0 1 0 12 h-3"
        fill="none"
        className={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M103 58 h8 l-4 -4 M111 58 l-4 4 M111 58 h-6 a6 6 0 0 0 0 12 h3"
        fill="none"
        className={ink}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={92} y={92} size={10} anchor="middle" tone="muted">
        Undo / Redo
      </Label>

      {/* Cards: the finder. */}
      <ClusterButton x={144} y={44} label="Cards">
        <rect
          x={-7}
          y={-6}
          width={10}
          height={12}
          rx={2}
          fill="none"
          className={ink}
          strokeWidth={1.6}
        />
        <circle cx={4} cy={2} r={3.5} fill="none" className={ink} strokeWidth={1.6} />
        <path d="M6.5 4.5 l3 3" className={ink} strokeWidth={1.6} strokeLinecap="round" />
      </ClusterButton>

      {/* Card Types, the button that stands where Layers does. */}
      <ClusterButton x={196} y={44} label="Card Types">
        <rect
          x={-7}
          y={-7}
          width={14}
          height={14}
          rx={2.5}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.6}
        />
        <rect x={-7} y={-7} width={3.5} height={14} rx={1.5} className="fill-brand-500" />
      </ClusterButton>

      {/* Theme and Canvas, the paintbrush. */}
      <ClusterButton x={250} y={44} label="Theme">
        <path
          d="M5 -7 l2 2 l-7 7 l-2 -2 Z M-2 2 c-3 0 -4 2 -4 5 c3 0 5 -1 5 -4"
          fill="none"
          className={ink}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </ClusterButton>

      {/* Zoom. */}
      <rect
        x={296}
        y={44}
        width={108}
        height={34}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={312} y={62} size={14} anchor="middle" tone="body">
        −
      </Label>
      <Label x={350} y={62} size={11} anchor="middle" weight={600} tone="body">
        100%
      </Label>
      <Label x={388} y={62} size={14} anchor="middle" tone="body">
        +
      </Label>
      <Label x={350} y={92} size={10} anchor="middle" tone="muted">
        Zoom
      </Label>

      <Label x={14} y={20} size={11} weight={600} tone="body">
        In Plan mode, bottom right
      </Label>
    </Scene>
  );
}

/** The Start with a Board picker an empty Plan tab shows: a tile per board type, each a small picture. */
export function PlanBoardPickerScene() {
  const tiles: { name: string; cols: number; rows?: boolean }[] = [
    { name: 'Blank', cols: 0 },
    { name: 'Kanban', cols: 5 },
    { name: 'Sprint', cols: 4, rows: true },
    { name: 'Bug Triage', cols: 5, rows: true },
    { name: 'Retro', cols: 3 },
    { name: 'Roadmap', cols: 3 },
    { name: 'Weekly Planner', cols: 5 },
    { name: 'All Cards', cols: 1, rows: true },
  ];
  return (
    <Scene w={420} h={230}>
      <rect
        x={20}
        y={12}
        width={380}
        height={208}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={210} y={32} size={14} weight={700} tone="strong" anchor="middle">
        Start with a Board
      </Label>
      {tiles.map((t, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 34 + col * 90;
        const y = 48 + row * 84;
        const pic = { x: x + 6, y: y + 6, w: 70, h: 42 };
        const cw = t.cols ? (pic.w - (t.cols + 1) * 3) / t.cols : 0;
        return (
          <g key={t.name}>
            <rect
              x={x}
              y={y}
              width={82}
              height={74}
              rx={8}
              className={i === 1 ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
              strokeWidth={1.5}
            />
            <rect
              x={pic.x}
              y={pic.y}
              width={pic.w}
              height={pic.h}
              rx={4}
              className="fill-slate-50"
            />
            {t.cols === 0 ? (
              <rect
                x={pic.x + 22}
                y={pic.y + 10}
                width={26}
                height={22}
                rx={3}
                fill="none"
                className="stroke-slate-300"
                strokeDasharray="3 2"
              />
            ) : (
              Array.from({ length: t.cols }, (_, c) => (
                <g key={c}>
                  <rect
                    x={pic.x + 3 + c * (cw + 3)}
                    y={pic.y + 4}
                    width={cw}
                    height={pic.h - 8}
                    rx={2}
                    className="fill-slate-100"
                  />
                  <rect
                    x={pic.x + 4.5 + c * (cw + 3)}
                    y={pic.y + 8}
                    width={cw - 3}
                    height={6}
                    rx={1.5}
                    className={c % 2 ? 'fill-brand-300' : 'fill-slate-300'}
                  />
                </g>
              ))
            )}
            {t.rows && (
              <line
                x1={pic.x + 2}
                y1={pic.y + 24}
                x2={pic.x + pic.w - 2}
                y2={pic.y + 24}
                className="stroke-slate-300"
                strokeWidth={1}
              />
            )}
            <Label x={x + 41} y={y + 62} size={10} weight={600} tone="strong" anchor="middle">
              {t.name}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** A column's cog popover: name, colour, WIP limit, width, Counts as Done, moving, adding and removing. */
export function PlanColumnSettingsScene() {
  const swatches = [
    'fill-rose-500',
    'fill-amber-500',
    'fill-emerald-500',
    'fill-teal-500',
    'fill-brand-500',
    'fill-indigo-500',
    'fill-violet-500',
    'fill-slate-400',
  ];
  return (
    <Scene w={420} h={260}>
      {/* The column the cog belongs to. */}
      <rect
        x={14}
        y={20}
        width={140}
        height={220}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
      />
      <Label x={24} y={36} size={11} weight={700} tone="strong">
        In progress
      </Label>
      <Label x={134} y={36} size={10} anchor="end" weight={700} className="fill-amber-500">
        3 / 3
      </Label>
      <Cog cx={146} cy={36} on />
      <Card x={22} y={52} type="task" num={9} title="Fix login" w={124} />
      <Card x={22} y={88} type="task" num={11} title="New icons" w={124} />
      <Card x={22} y={124} type="project" num={2} title="Launch" w={124} />

      <Arrow2 from={[154, 36]} to={[162, 36]} />

      {/* The popover. */}
      <rect
        x={162}
        y={14}
        width={240}
        height={236}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={174}
        y={24}
        width={216}
        height={22}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1}
      />
      <Label x={182} y={36} size={11} tone="strong">
        In progress
      </Label>
      <circle cx={182} cy={60} r={6} fill="none" className="stroke-slate-300" strokeWidth={1.2} />
      <path d="M178 64 l8 -8" className="stroke-slate-300" strokeWidth={1.2} />
      {swatches.map((cls, i) => (
        <circle key={cls} cx={198 + i * 16} cy={60} r={6} className={cls} />
      ))}
      <Label x={174} y={84} size={11} tone="strong">
        WIP Limit
      </Label>
      <Label x={174} y={98} size={10} tone="muted">
        Warns past 3 cards
      </Label>
      <rect x={324} y={78} width={66} height={22} rx={5} className="fill-white stroke-slate-200" />
      <Label x={335} y={90} size={12} anchor="middle" tone="body">
        −
      </Label>
      <Label x={357} y={90} size={11} anchor="middle" weight={600} tone="strong">
        3
      </Label>
      <Label x={379} y={90} size={12} anchor="middle" tone="body">
        +
      </Label>
      <Label x={174} y={120} size={11} tone="strong">
        Width
      </Label>
      <Label x={174} y={134} size={10} tone="muted">
        Slots across the board
      </Label>
      <rect x={330} y={114} width={60} height={22} rx={5} className="fill-white stroke-slate-200" />
      <rect x={331} y={115} width={20} height={20} rx={4} className="fill-brand-50" />
      <rect x={339} y={120} width={4} height={10} rx={1} className="fill-brand-600" />
      <rect x={355} y={120} width={4} height={10} rx={1} className="fill-slate-400" />
      <rect x={361} y={120} width={4} height={10} rx={1} className="fill-slate-400" />
      <rect x={372} y={120} width={3} height={10} rx={1} className="fill-slate-400" />
      <rect x={377} y={120} width={3} height={10} rx={1} className="fill-slate-400" />
      <rect x={382} y={120} width={3} height={10} rx={1} className="fill-slate-400" />
      <Label x={174} y={156} size={11} tone="strong">
        Counts as Done
      </Label>
      <rect x={364} y={148} width={26} height={15} rx={7.5} className="fill-slate-200" />
      <circle cx={372} cy={155.5} r={5.5} className="fill-white" />
      <Button x={174} y={172} w={104} h={22} label="Move Left" />
      <Button x={286} y={172} w={104} h={22} label="Move Right" />
      <Label x={174} y={210} size={11} weight={600} tone="accent">
        + Add Column After
      </Label>
      <Label x={174} y={234} size={11} weight={600} className="fill-rose-500">
        Remove Column
      </Label>
    </Scene>
  );
}

/** A plain straight pointer line with no head, for "this opens that". */
function Arrow2({ from, to }: { from: [number, number]; to: [number, number] }) {
  return (
    <path
      d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`}
      className="stroke-brand-300"
      strokeWidth={1.5}
      strokeDasharray="3 2"
    />
  );
}

/** The card panel: a breadcrumb back to the project, the type and number, Help, the ⋯ menu and close;
 *  the title over the type's tabs and description; Child Cards; Details on the right. */
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
      {/* Header. */}
      <rect x={20} y={20} width={8} height={14} rx={2} className={STRIPE.project} />
      <Label x={32} y={28} size={10} tone="body">
        #2 Launch
      </Label>
      <Label x={84} y={28} size={11} tone="muted">
        ›
      </Label>
      <rect x={94} y={21} width={4} height={14} rx={1.5} className={STRIPE.task} />
      <Label x={102} y={28} size={11} weight={700} tone="strong">
        Task
      </Label>
      <Label x={132} y={28} size={11} tone="muted">
        #11
      </Label>
      <circle cx={318} cy={28} r={6} fill="none" className="stroke-slate-400" strokeWidth={1.3} />
      <Label x={318} y={29} size={10} anchor="middle" tone="muted">
        ?
      </Label>
      <Label x={328} y={28} size={10} tone="muted">
        Help
      </Label>
      <Label x={368} y={27} size={13} anchor="middle" weight={700} tone="muted">
        ⋯
      </Label>
      <Label x={394} y={28} size={12} anchor="middle" tone="muted">
        ✕
      </Label>
      <line x1={10} y1={44} x2={410} y2={44} className="stroke-slate-200" strokeWidth={1.5} />

      {/* Main column. */}
      <Label x={24} y={62} size={14} weight={700} tone="strong">
        New icons
      </Label>
      <Tabs x={22} y={76} items={['Overview']} tabW={70} h={20} />
      <TextBar x={24} y={106} w={200} />
      <TextBar x={24} y={118} w={170} />
      <TextBar x={24} y={130} w={120} tone="faint" />
      <Label x={24} y={154} size={10} weight={700} tone="body">
        Child Cards 2
      </Label>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect
            x={22}
            y={164 + i * 26}
            width={240}
            height={22}
            rx={5}
            className="fill-slate-50 stroke-slate-200"
            strokeWidth={1}
          />
          <rect x={26} y={169 + i * 26} width={3} height={12} rx={1} className={STRIPE.task} />
          <Label x={34} y={175 + i * 26} size={10} tone="muted">
            {i ? '#17' : '#16'}
          </Label>
          <Label x={58} y={175 + i * 26} size={10} tone="strong">
            {i ? 'Export set' : 'Draw glyphs'}
          </Label>
          <Label x={256} y={175 + i * 26} size={10} anchor="end" tone="muted">
            {i ? 'To do' : 'In progress'}
          </Label>
        </g>
      ))}
      <Label x={24} y={228} size={10} tone="muted">
        Comments
      </Label>

      {/* Details. */}
      <rect x={278} y={52} width={124} height={190} rx={8} className="fill-slate-50" />
      <Label x={288} y={66} size={10} weight={700} tone="body">
        Details
      </Label>
      {[
        ['Status', 'In progress'],
        ['Assignee', 'Sam'],
        ['Parent', '#2 Launch'],
        ['Priority', 'High'],
        ['Due date', '14 Oct'],
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
        Made by Sam
      </Label>
      <Label x={288} y={230} size={10} tone="muted">
        Changed by Alex
      </Label>
    </Scene>
  );
}

/** Right-clicking a card: Open, Duplicate, Add to Slides, a Move to row per column, Flag, Archive, Trash. */
export function PlanCardMenuScene() {
  return (
    <Scene w={420} h={250}>
      <rect
        x={20}
        y={20}
        width={110}
        height={210}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
      />
      <Label x={30} y={36} size={11} weight={700} tone="strong">
        To do
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
          'Add to Slides',
          'Move to In progress',
          'Move to Review',
          'Flag',
          'Archive',
          'Trash',
        ]}
      />
      {/* The menu's header (the card's title), separators between its groups, and Trash in red. */}
      <rect x={154} y={24} width={172} height={21} rx={5} className="fill-white" />
      <Label x={162} y={35} size={10} weight={700} tone="muted">
        Write docs
      </Label>
      <line x1={156} y1={45} x2={324} y2={45} className="stroke-slate-200" />
      <line x1={156} y1={108} x2={324} y2={108} className="stroke-slate-200" />
      <line x1={156} y1={150} x2={324} y2={150} className="stroke-slate-200" />
      <rect x={154} y={192} width={172} height={21} rx={5} className="fill-white" />
      <Label x={162} y={203} size={11} className="fill-rose-500">
        Trash
      </Label>
    </Scene>
  );
}

/** The Card Types panel above its button: each type's stripe, glyph tint, name, fields and count. */
export function PlanCardTypesScene() {
  const rows: { type: CardType; name: string; fields: number; items: number }[] = [
    { type: 'project', name: 'Project', fields: 8, items: 3 },
    { type: 'task', name: 'Task', fields: 11, items: 14 },
    { type: 'note', name: 'Note', fields: 5, items: 6 },
    { type: 'idea', name: 'Idea', fields: 6, items: 2 },
    { type: 'action', name: 'Action', fields: 7, items: 4 },
  ];
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
              <Label x={142} y={y + 9} size={10} weight={600} tone="strong">
                {r.name}
              </Label>
              <Label x={142} y={y + 20} size={10} tone="muted">
                {r.fields} fields
              </Label>
              <Label x={300} y={y + 14} size={10} anchor="end" tone="muted">
                {r.items} items
              </Label>
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
          + Add Type
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
      {board(20, 'Sprint', ['To do', 'Doing', 'Done'], 1)}
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
