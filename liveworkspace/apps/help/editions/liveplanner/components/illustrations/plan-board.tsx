// Plan mode's board scenes (docs/specs/026-plan/), re-exported from ./plan: a board with its header widgets
// and columns, the board picker and a column's settings. Composed from the shared primitives so the house
// style holds.

import { Scene, Label, Cursor } from '@liveworkspace/help-site/art/primitives';
import { Card, Widget, Cog, Column, Arrow2 } from './plan-parts';
import { StartBandLanes, StartTitleMarkLanes } from './start-band';

/** A Kanban board in Plan mode: header widgets, a column over its WIP limit (the preset's 3) with its
 *  cog, Task and Action cards (the types Kanban takes) with their type stripes, a card being dragged into the gap it opens, and + Add card. */
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
      {/* The Kanban preset's widgets, in its order. */}
      <Widget x={80} y={16} w={74} label="Completion" />
      <Widget x={160} y={16} w={74} label="WIP Alerts" />
      <Widget x={240} y={16} w={66} label="Filter" />
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

      <Column x={xs[0]!} y={44} w={colW} h={190} name="To Do" count="2" />
      <Column x={xs[1]!} y={44} w={colW} h={190} name="In Progress" count="4 / 3" warn cog />
      <Column x={xs[2]!} y={44} w={colW} h={190} name="Review" count="1" />

      {/* To Do: one card left, its neighbour is on its way to Review. */}
      <Card x={xs[0]! + 7} y={66} w={cw} type="action" num={15} title="Pick a date" />
      <Label x={xs[0]! + 11} y={110} size={10} tone="muted">
        + Add card
      </Label>

      <Card x={xs[1]! + 7} y={66} w={cw} type="task" num={9} title="Fix login" />
      <Card x={xs[1]! + 7} y={102} w={cw} type="task" num={11} title="New icons" />
      <Card x={xs[1]! + 7} y={138} w={cw} type="task" num={2} title="Launch" />
      <Card x={xs[1]! + 7} y={174} w={cw} type="action" num={12} title="Book venue" />

      <Card x={xs[2]! + 7} y={66} w={cw} type="action" num={8} title="Copy check" />
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
      <Card x={xs[2]! + 9} y={150} w={cw} type="task" num={14} title="Write docs" lifted />
      <Cursor x={xs[2]! + 98} y={170} />
    </Scene>
  );
}

/** The Start Planning picker an empty Plan tab shows, on its Boards tab: a tile per board type in the
 *  picker's order, each a small picture. */
export function PlanBoardPickerScene() {
  const tiles: { name: string; cols: number; rows?: boolean }[] = [
    { name: 'Blank', cols: 0 },
    { name: 'Kanban', cols: 5 },
    { name: 'To-do List', cols: 2 },
    { name: 'Sprint', cols: 4, rows: true },
    { name: 'Retro', cols: 3 },
    { name: 'Roadmap', cols: 3 },
    { name: 'Bug Triage', cols: 5, rows: true },
    { name: 'Weekly Planner', cols: 5 },
    { name: 'All Cards', cols: 1, rows: true },
  ];
  return (
    <Scene w={420} h={292}>
      <rect
        x={20}
        y={12}
        width={380}
        height={270}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* The header band: the board lanes, then the title mark and the title. */}
      <StartBandLanes x={23} y={15} w={374} h={35} />
      <StartTitleMarkLanes x={30} y={23} />
      <Label x={54} y={36} size={13} weight={800} tone="strong">
        Start Planning
      </Label>
      {/* The search, at the header's right. */}
      <rect x={246} y={22} width={140} height={20} rx={6} className="fill-white stroke-slate-200" />
      <Label x={256} y={36} size={8} tone="muted">
        Find a board, sheet or layout
      </Label>
      <line x1={20} y1={52} x2={400} y2={52} className="stroke-slate-200" strokeWidth={1} />
      {/* The rail: Boards chosen. */}
      <line x1={112} y1={52} x2={112} y2={282} className="stroke-slate-200" strokeWidth={1} />
      {['Recommended', 'Boards', 'Spreadsheets', 'Visualisations', 'Dashboards', 'Inspiration'].map(
        (name, i) => (
          <g key={name}>
            {i === 1 ? (
              <rect
                x={26}
                y={60 + i * 22}
                width={80}
                height={18}
                rx={5}
                className="fill-brand-50"
              />
            ) : null}
            {/* Inspiration sits under a hairline. */}
            {i === 5 ? (
              <line
                x1={30}
                y1={60 + i * 22 - 3}
                x2={102}
                y2={60 + i * 22 - 3}
                className="stroke-slate-200"
                strokeWidth={1}
              />
            ) : null}
            <Label
              x={34}
              y={72 + i * 22}
              size={8.5}
              weight={i === 1 ? 700 : 500}
              tone={i === 1 ? 'accent' : 'strong'}
            >
              {name}
            </Label>
          </g>
        ),
      )}
      {tiles.map((t, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 122 + col * 92;
        const y = 62 + row * 72;
        const pic = { x: x + 5, y: y + 5, w: 76, h: 34 };
        const cw = t.cols ? (pic.w - (t.cols + 1) * 3) / t.cols : 0;
        return (
          <g key={t.name}>
            <rect
              x={x}
              y={y}
              width={86}
              height={64}
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
                x={pic.x + 25}
                y={pic.y + 6}
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
                    y={pic.y + 3}
                    width={cw}
                    height={pic.h - 6}
                    rx={2}
                    className="fill-slate-100"
                  />
                  <rect
                    x={pic.x + 4.5 + c * (cw + 3)}
                    y={pic.y + 6}
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
                y1={pic.y + 20}
                x2={pic.x + pic.w - 2}
                y2={pic.y + 20}
                className="stroke-slate-300"
                strokeWidth={1}
              />
            )}
            <Label x={x + 7} y={y + 52} size={9} weight={600} tone="strong">
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
    'fill-pink-500',
    'fill-orange-500',
    'fill-slate-400',
  ];
  return (
    <Scene w={420} h={266}>
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
        In Progress
      </Label>
      {/* At its limit, not past it: the count only turns amber over the limit. */}
      <Label x={134} y={36} size={10} anchor="end" className="fill-slate-400">
        3 / 3
      </Label>
      <Cog cx={146} cy={36} on />
      <Card x={22} y={52} type="task" num={9} title="Fix login" w={124} />
      <Card x={22} y={88} type="task" num={11} title="New icons" w={124} />
      <Card x={22} y={124} type="task" num={2} title="Launch" w={124} />

      <Arrow2 from={[154, 36]} to={[162, 36]} />

      {/* The popover. */}
      <rect
        x={162}
        y={14}
        width={240}
        height={238}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* The toolbar: Move Left and Move Right at the start, Remove at the end. */}
      <path d="M163 42 h238" className="stroke-slate-100" strokeWidth={1} />
      <rect x={172} y={20} width={44} height={16} rx={4} className="fill-white stroke-slate-200" />
      <path d="M194 20 v16" className="stroke-slate-200" strokeWidth={1} />
      <path
        d="M185 24.5 l-3.5 3.5 l3.5 3.5 M203 24.5 l3.5 3.5 l-3.5 3.5"
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={335}
        y={23}
        width={4}
        height={10}
        rx={1}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.1}
      />
      <rect
        x={341}
        y={23}
        width={4}
        height={10}
        rx={1}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.1}
      />
      <Label x={392} y={28} size={11} weight={600} anchor="end" tone="body">
        Remove
      </Label>
      <g transform="translate(0 26)">
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
          In Progress
        </Label>
        <circle cx={182} cy={60} r={6} fill="none" className="stroke-slate-300" strokeWidth={1.2} />
        <path d="M178 64 l8 -8" className="stroke-slate-300" strokeWidth={1.2} />
        {swatches.map((cls, i) => (
          <circle key={cls} cx={196 + i * 16} cy={60} r={6} className={cls} />
        ))}
        {/* Custom colour. */}
        <circle
          cx={356}
          cy={60}
          r={6}
          fill="none"
          className="stroke-slate-400"
          strokeWidth={1.2}
          strokeDasharray="2 2"
        />
        <path d="M353 60 h6 M356 57 v6" className="stroke-slate-500" strokeWidth={1.2} />
        <Label x={174} y={84} size={11} tone="strong">
          WIP Limit
        </Label>
        <Label x={174} y={98} size={10} tone="muted">
          Warns past 3 cards
        </Label>
        <rect
          x={324}
          y={78}
          width={66}
          height={22}
          rx={5}
          className="fill-white stroke-slate-200"
        />
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
        <rect
          x={330}
          y={114}
          width={60}
          height={22}
          rx={5}
          className="fill-white stroke-slate-200"
        />
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
      </g>
      <Label x={174} y={208} size={11} weight={600} tone="accent">
        + Add Column After
      </Label>
      <Label x={174} y={232} size={11} weight={600} className="fill-rose-600">
        Delete Status
      </Label>
    </Scene>
  );
}
