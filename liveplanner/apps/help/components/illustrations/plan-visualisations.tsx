// Plan visualisation illustrations (docs/specs/026-plan/plan-views.md, plan-mode.md "Starting a board"): Start
// Planning on its Visualisations category, and a Gantt chart in swimlanes with its Chart Settings open. Composed
// from the shared primitives; the labels are the editor's own (StartPlanning, start-planning-items,
// VISUALISATION_INFO, GanttView, GanttScaleControls, gantt-rows, PlanViewSettingsPanel, SWIMLANE_LABELS).

import type { ReactNode } from 'react';
import { Scene, Label, TextBar, Tabs } from '@liveworkspace/help-site/art/primitives';

// --- Start Planning: Visualisations ------------------------------------------

type Pic = { x: number; y: number; w: number; h: number };

/** A small picture of each chart, as Start Planning's card draws one. */
function VisualisationPicture({ kind, p }: { kind: string; p: Pic }) {
  if (kind === 'gantt') {
    const bars = [
      [6, 30, 'fill-indigo-400'],
      [22, 26, 'fill-teal-400'],
      [34, 30, 'fill-indigo-300'],
      [14, 20, 'fill-amber-400'],
    ] as const;
    return (
      <g>
        {bars.map(([dx, w, cls], i) => (
          <rect
            key={i}
            x={p.x + dx}
            y={p.y + 7 + i * 9}
            width={w}
            height={5}
            rx={2}
            className={cls}
          />
        ))}
        <line
          x1={p.x + 40}
          y1={p.y + 4}
          x2={p.x + 40}
          y2={p.y + p.h - 4}
          className="stroke-brand-500"
          strokeWidth={1}
        />
      </g>
    );
  }
  if (kind === 'calendar' || kind === 'start') {
    const dots = kind === 'calendar' ? [3, 9, 12, 16, 20] : [1, 6, 10, 15, 19];
    const cw = (p.w - 8) / 7;
    const ch = (p.h - 8) / 3;
    return (
      <g>
        {Array.from({ length: 21 }, (_, i) => (
          <rect
            key={i}
            x={p.x + 4 + (i % 7) * cw}
            y={p.y + 4 + Math.floor(i / 7) * ch}
            width={cw - 1.5}
            height={ch - 1.5}
            rx={1.5}
            className={dots.includes(i) ? 'fill-brand-200' : 'fill-white'}
          />
        ))}
      </g>
    );
  }
  if (kind === 'workload') {
    const rows = [
      [14, 10, 12],
      [8, 14, 6],
      [18, 6, 10],
    ];
    return (
      <g>
        {rows.map((r, i) => {
          let x = p.x + 18;
          return (
            <g key={i}>
              <circle cx={p.x + 10} cy={p.y + 10 + i * 10} r={3} className="fill-slate-300" />
              {r.map((w, j) => {
                const seg = (
                  <rect
                    key={j}
                    x={x}
                    y={p.y + 7 + i * 10}
                    width={w}
                    height={6}
                    className={['fill-slate-300', 'fill-brand-300', 'fill-emerald-400'][j]}
                  />
                );
                x += w;
                return seg;
              })}
            </g>
          );
        })}
      </g>
    );
  }
  if (kind === 'priority') {
    const shade = [
      ['fill-rose-300', 'fill-rose-200', 'fill-rose-100'],
      ['fill-amber-300', 'fill-amber-200', 'fill-amber-100'],
      ['fill-slate-300', 'fill-slate-200', 'fill-slate-100'],
    ];
    const cw = (p.w - 12) / 3;
    const ch = (p.h - 10) / 3;
    return (
      <g>
        {shade.map((row, r) =>
          row.map((cls, c) => (
            <rect
              key={`${r}-${c}`}
              x={p.x + 6 + c * cw}
              y={p.y + 5 + r * ch}
              width={cw - 2}
              height={ch - 2}
              rx={1.5}
              className={cls}
            />
          )),
        )}
      </g>
    );
  }
  // Card Search: a filter chip over cards side by side.
  return (
    <g>
      <rect
        x={p.x + 5}
        y={p.y + 4}
        width={30}
        height={7}
        rx={3.5}
        className="fill-brand-100 stroke-brand-300"
        strokeWidth={0.8}
      />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={p.x + 5 + i * 22}
            y={p.y + 15}
            width={19}
            height={14}
            rx={2}
            className="fill-white stroke-slate-200"
            strokeWidth={0.8}
          />
          <rect
            x={p.x + 5 + i * 22}
            y={p.y + 15}
            width={2}
            height={14}
            className="fill-slate-700"
          />
        </g>
      ))}
    </g>
  );
}

/** Start Planning on an empty Plan tab, its Visualisations category chosen: a card per chart, each its picture,
 *  its name and its line. */
export function PlanVisualisationsPickerScene() {
  const rail = ['Recommended', 'Boards', 'Spreadsheets', 'Visualisations', 'Dashboards'];
  const cards = [
    { kind: 'gantt', name: 'Gantt Chart' },
    { kind: 'calendar', name: 'Due Calendar' },
    { kind: 'start', name: 'Start Calendar' },
    { kind: 'workload', name: 'Cards by Field' },
    { kind: 'priority', name: 'Priority Matrix' },
    { kind: 'search', name: 'Card Search' },
  ];
  return (
    <Scene w={420} h={300}>
      <rect
        x={10}
        y={10}
        width={400}
        height={280}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={24} y={30} size={13} weight={700} tone="strong">
        Start Planning
      </Label>
      {/* The search, at the header's right. */}
      <rect
        x={264}
        y={19}
        width={134}
        height={22}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={272} y={31} size={7.5} tone="muted">
        Find a board, sheet or layout
      </Label>
      <line x1={10} y1={48} x2={410} y2={48} className="stroke-slate-200" strokeWidth={1} />
      {/* The rail, Visualisations chosen, then Inspiration under a hairline. */}
      <line x1={106} y1={48} x2={106} y2={290} className="stroke-slate-200" strokeWidth={1} />
      {rail.map((name, i) => (
        <g key={name}>
          {i === 3 ? (
            <rect x={16} y={56 + i * 22} width={84} height={18} rx={5} className="fill-brand-50" />
          ) : null}
          <Label
            x={24}
            y={66 + i * 22}
            size={8}
            weight={i === 3 ? 700 : 500}
            tone={i === 3 ? 'accent' : 'strong'}
          >
            {name}
          </Label>
        </g>
      ))}
      <line x1={20} y1={170} x2={96} y2={170} className="stroke-slate-200" strokeWidth={1} />
      <Label x={24} y={184} size={8} weight={500} tone="strong">
        Inspiration
      </Label>
      {/* The category's heading and its line. */}
      <Label x={118} y={62} size={10} weight={700} tone="strong">
        Visualisations
      </Label>
      <TextBar x={118} y={71} w={210} h={5} />
      {cards.map((c, i) => {
        const x = 118 + (i % 3) * 96;
        const y = 84 + Math.floor(i / 3) * 102;
        const pic = { x: x + 5, y: y + 5, w: 80, h: 44 };
        return (
          <g key={c.name}>
            <rect
              x={x}
              y={y}
              width={90}
              height={96}
              rx={9}
              className={i === 0 ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
              strokeWidth={1.5}
            />
            <rect
              x={pic.x}
              y={pic.y}
              width={pic.w}
              height={pic.h}
              rx={5}
              className="fill-slate-100"
            />
            <VisualisationPicture kind={c.kind} p={pic} />
            <Label x={x + 7} y={y + 62} size={8.5} weight={700} tone="strong">
              {c.name}
            </Label>
            <TextBar x={x + 7} y={y + 72} w={74} h={4} tone="faint" />
            <TextBar x={x + 7} y={y + 80} w={52} h={4} tone="faint" />
          </g>
        );
      })}
    </Scene>
  );
}

// --- Gantt chart in swimlanes, with Chart Settings ---------------------------

/** A header icon button (Maximise View, the cog). */
function HeaderButton({
  x,
  y,
  on = false,
  children,
}: {
  x: number;
  y: number;
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={18}
        height={18}
        rx={4}
        className={on ? 'fill-brand-100' : 'fill-transparent'}
      />
      <g transform={`translate(${x + 9} ${y + 9})`}>{children}</g>
    </g>
  );
}

type GanttRow = {
  num: number;
  title: string;
  // Bar start and width on the timeline, or a diamond at `start` when `w` is 0.
  start: number;
  w: number;
  done: number;
  colour: string;
  light: string;
};

/** A Gantt chart grouped by Assignee, a row's grip showing Drag to Reorder, and its cog's Chart Settings open on
 *  Swimlanes. */
export function PlanGanttSwimlanesScene() {
  const names = 120;
  const lanes: { name: string; rows: GanttRow[] }[] = [
    {
      name: 'Sam',
      rows: [
        {
          num: 3,
          title: 'Site redesign',
          start: 140,
          w: 70,
          done: 0.6,
          colour: 'fill-indigo-500',
          light: 'fill-indigo-200',
        },
        {
          num: 7,
          title: 'Launch email',
          start: 234,
          w: 0,
          done: 0,
          colour: 'fill-amber-500',
          light: 'fill-amber-200',
        },
      ],
    },
    {
      name: 'Alex',
      rows: [
        {
          num: 5,
          title: 'Pricing page',
          start: 170,
          w: 64,
          done: 0.3,
          colour: 'fill-teal-500',
          light: 'fill-teal-200',
        },
        {
          num: 9,
          title: 'User testing',
          start: 196,
          w: 56,
          done: 0,
          colour: 'fill-indigo-500',
          light: 'fill-indigo-200',
        },
      ],
    },
  ];
  const axisY = 40;
  const laneH = 16;
  const rowH = 22;
  let y = axisY + 18;
  const drawn: ReactNode[] = [];
  lanes.forEach((lane) => {
    const top = y;
    drawn.push(
      <g key={`lane-${lane.name}`}>
        <rect x={11} y={top} width={398} height={laneH} className="fill-slate-50" />
        <Label x={18} y={top + laneH / 2 + 1} size={8} tone="muted">
          ▾
        </Label>
        <circle cx={34} cy={top + laneH / 2} r={5} className="fill-brand-200" />
        <Label x={44} y={top + laneH / 2 + 1} size={8.5} weight={700} tone="strong">
          {lane.name}
        </Label>
        <Label
          x={names - 6}
          y={top + laneH / 2 + 1}
          size={8}
          weight={600}
          tone="muted"
          anchor="end"
        >
          {lane.rows.length}
        </Label>
      </g>,
    );
    y += laneH;
    lane.rows.forEach((r, i) => {
      const ry = y;
      const hovered = lane.name === 'Alex' && i === 1;
      drawn.push(
        <g key={`row-${r.num}`}>
          {hovered ? (
            <rect x={11} y={ry} width={names - 1} height={rowH} className="fill-slate-100" />
          ) : null}
          {hovered ? (
            // The six-dot grip at the row's left edge.
            <g>
              {[0, 1, 2].map((d) => (
                <g key={d}>
                  <circle cx={14} cy={ry + 7 + d * 4} r={1} className="fill-slate-400" />
                  <circle cx={18} cy={ry + 7 + d * 4} r={1} className="fill-slate-400" />
                </g>
              ))}
            </g>
          ) : null}
          <Label x={24} y={ry + rowH / 2 + 1} size={8} tone="muted">
            #{r.num}
          </Label>
          <Label x={40} y={ry + rowH / 2 + 1} size={8.5} weight={600} tone="strong">
            {r.title}
          </Label>
          {r.w > 0 ? (
            <g>
              <rect x={r.start} y={ry + 6} width={r.w} height={10} rx={3} className={r.light} />
              {r.done > 0 ? (
                <rect
                  x={r.start}
                  y={ry + 6}
                  width={r.w * r.done}
                  height={10}
                  rx={3}
                  className={r.colour}
                />
              ) : null}
            </g>
          ) : (
            <rect
              x={r.start - 5}
              y={ry + rowH / 2 - 5}
              width={10}
              height={10}
              rx={1.5}
              transform={`rotate(45 ${r.start} ${ry + rowH / 2})`}
              className={r.colour}
            />
          )}
        </g>,
      );
      y += rowH;
    });
  });
  const rowsEnd = y;
  // The grip's tooltip, under the hovered row.
  const tipY = rowsEnd + 4;
  return (
    <Scene w={420} h={266}>
      <rect
        x={10}
        y={10}
        width={400}
        height={246}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* The header: name, Today, the steps, the scale, Maximise View and the cog. */}
      <Label x={22} y={26} size={11} weight={700} tone="strong">
        Gantt Chart
      </Label>
      <rect
        x={142}
        y={17}
        width={36}
        height={18}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={160} y={27} size={8.5} weight={600} anchor="middle">
        Today
      </Label>
      <Label x={190} y={27} size={10} tone="muted" anchor="middle">
        ‹
      </Label>
      <Label x={204} y={27} size={10} tone="muted" anchor="middle">
        ›
      </Label>
      <Tabs x={218} y={16} items={['Month', 'Quarter', 'Year']} tabW={44} h={20} />
      <HeaderButton x={356} y={17}>
        <path
          d="M-4 -1.5v-2.5h2.5M4 -1.5v-2.5h-2.5M-4 1.5v2.5h2.5M4 1.5v2.5h-2.5"
          fill="none"
          className="stroke-slate-500"
          strokeWidth={1.3}
        />
      </HeaderButton>
      <HeaderButton x={380} y={17} on>
        <circle r={3} fill="none" className="stroke-brand-600" strokeWidth={1.4} />
        <path
          d="M0 -6v1.6M0 4.4v1.6M-6 0h1.6M4.4 0h1.6"
          className="stroke-brand-600"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </HeaderButton>
      <line x1={10} y1={axisY} x2={410} y2={axisY} className="stroke-slate-200" strokeWidth={1} />
      {/* The axis: a week per tick, gridlines down the timeline. */}
      {['Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Nov 2'].map((t, i) => {
        const x = names + 14 + i * 46;
        return (
          <g key={t}>
            <line
              x1={x}
              y1={axisY + 18}
              x2={x}
              y2={rowsEnd}
              className="stroke-slate-100"
              strokeWidth={1}
            />
            <Label x={x + 3} y={axisY + 9} size={7.5} tone="muted">
              {t}
            </Label>
          </g>
        );
      })}
      <line
        x1={names + 10}
        y1={axisY}
        x2={names + 10}
        y2={rowsEnd}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {drawn}
      {/* Today. */}
      <line
        x1={214}
        y1={axisY + 18}
        x2={214}
        y2={rowsEnd}
        className="stroke-brand-500"
        strokeWidth={1.2}
      />
      {/* Drag to Reorder, the grip's tooltip. */}
      <rect x={12} y={tipY} width={84} height={18} rx={5} className="fill-slate-800" />
      <Label x={54} y={tipY + 9.5} size={8} weight={600} anchor="middle" tone="onAccent">
        Drag to Reorder
      </Label>
      <Label x={24} y={tipY + 34} size={8.5} weight={600} tone="muted">
        + Add Card
      </Label>
      {/* Chart Settings, hung from the cog: Card Types, Swimlanes (open, Assignee picked) and Row Order. */}
      <g>
        <rect
          x={262}
          y={42}
          width={142}
          height={200}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        {[
          { title: 'Card Types', y: 48, open: false },
          { title: 'Swimlanes', y: 70, open: true },
          { title: 'Row Order', y: 212, open: false },
        ].map((s) => (
          <g key={s.title}>
            <Label x={274} y={s.y + 11} size={9} weight={700} tone="strong">
              {s.title}
            </Label>
            <Label x={392} y={s.y + 11} size={8} tone="muted" anchor="end">
              {s.open ? '▾' : '▸'}
            </Label>
          </g>
        ))}
        <line x1={266} y1={70} x2={400} y2={70} className="stroke-slate-100" strokeWidth={1} />
        <line x1={266} y1={212} x2={400} y2={212} className="stroke-slate-100" strokeWidth={1} />
        {['None', 'Assignee', 'Type', 'Priority', 'Status'].map((opt, i) => {
          const oy = 94 + i * 22;
          const on = opt === 'Assignee';
          return (
            <g key={opt}>
              <rect
                x={270}
                y={oy}
                width={126}
                height={19}
                rx={5}
                className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
                strokeWidth={1}
              />
              <Label
                x={280}
                y={oy + 10}
                size={8.5}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {opt}
              </Label>
              {on ? <circle cx={386} cy={oy + 9.5} r={3} className="fill-brand-500" /> : null}
            </g>
          );
        })}
      </g>
    </Scene>
  );
}
