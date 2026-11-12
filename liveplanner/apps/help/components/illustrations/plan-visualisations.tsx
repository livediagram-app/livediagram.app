// Plan visualisation illustrations (docs/specs/026-plan/plan-views.md, plan-mode.md "Starting a board"): Start
// Planning on its Visualisations category, and a Gantt chart in swimlanes with its Chart Settings open. Composed
// from the shared primitives; the labels are the editor's own (StartPlanning, start-planning-items,
// VISUALISATION_INFO, GanttView, GanttScaleControls, gantt-rows, PlanViewSettingsPanel, SWIMLANE_LABELS).

import { Scene, Label, TextBar } from '@liveworkspace/help-site/art/primitives';
import { StartBandLanes, StartTitleMarkLanes } from './start-band';

// The Gantt chart in swimlanes lives in plan-visualisations-gantt.tsx.
export { PlanGanttSwimlanesScene } from './plan-visualisations-gantt';

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
      {/* The header band: the board lanes, then the title mark and the title. */}
      <StartBandLanes x={13} y={13} w={394} h={33} />
      <StartTitleMarkLanes x={20} y={20} />
      <Label x={44} y={33} size={13} weight={800} tone="strong">
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
