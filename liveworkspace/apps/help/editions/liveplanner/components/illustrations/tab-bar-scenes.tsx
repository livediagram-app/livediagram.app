// The bottom bar and its tabs in liveplanner (tabs/using-tabs, tabs/side-by-side, tools/dark-mode): the bar under
// a plan's board with a tab per Board, Sheet and Dashboard, dragging a tab out to open it side by side, the two
// panes sharing one bar, and the appearance switch at the bar's right-hand end. Drawn from ./planner-chrome.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BoardFragment } from './board-fragment';
import { ChromeCard, HAIR } from './planner-chrome';
import { BAR_H, barTabLefts, barTabW, BottomBar, type BarTab } from './planner-bars';
import { Glyph } from './planner-glyphs';
import { BUDGET_ROWS, SheetFragment } from './sheet-fragment';

const PLAN_TABS: BarTab[] = [
  { name: 'Roadmap', kind: 'board' },
  { name: 'Sprint 12', kind: 'board' },
  { name: 'Budget', kind: 'sheet' },
  { name: 'Overview', kind: 'dashboard' },
];

/** The bottom bar under a board: a tab per Board, Sheet and Dashboard (each with its kind's icon), the open one
 *  raised with its ⋯, then +, and the quick controls at the far end. */
export function TabBarOverview() {
  return (
    <Scene w={440} h={200}>
      <BoardFragment
        x={6}
        y={6}
        w={428}
        h={148}
        columns={[
          { name: 'To Do', cards: [{ type: 'story', num: 6, title: 'Sync status icon' }] },
          { name: 'In Progress', cards: [{ type: 'task', num: 14, title: 'Currency picker' }] },
          { name: 'Done', cards: [{ type: 'task', num: 3, title: 'Login page' }] },
        ]}
      />
      <BottomBar y={166} w={440} tabs={PLAN_TABS} active={1} getStarted={false} />
    </Scene>
  );
}

/** Dragging the Budget tab to the window's right edge: the board stays on the left and the drop preview on the
 *  right says what will open there. */
export function SideBySideDrag() {
  return (
    <Scene w={440} h={230}>
      <BoardFragment
        x={6}
        y={6}
        w={428}
        h={176}
        columns={[
          { name: 'To Do', cards: [{ type: 'story', num: 6, title: 'Sync status icon' }] },
          { name: 'In Progress', cards: [{ type: 'task', num: 14, title: 'Currency picker' }] },
          { name: 'Done', cards: [{ type: 'task', num: 3, title: 'Login page' }] },
        ]}
      />
      {/* The drop preview: the right half, tinted, naming the tab it will open. */}
      <rect
        x={226}
        y={10}
        width={204}
        height={168}
        rx={8}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <Glyph name="sheet" x={328} y={84} s={1.6} brand />
      <Label x={328} y={106} size={10} weight={600} anchor="middle" tone="accent">
        Open Budget Side by Side
      </Label>
      <BottomBar y={194} w={440} tabs={PLAN_TABS} active={1} getStarted={false} />
      {/* The Budget tab, lifted off the bar and on its way to the right edge. */}
      <g transform="translate(300 150) rotate(-4)">
        <rect
          x={0}
          y={0}
          width={60}
          height={20}
          rx={5}
          className="fill-white stroke-brand-400"
          strokeWidth={1}
        />
        <Glyph name="sheet" x={11} y={10} s={0.7} brand />
        <Label x={18} y={10.5} size={9} weight={600} tone="accent">
          Budget
        </Label>
      </g>
      <path
        d="M330 183 C 340 175, 345 172, 350 168"
        fill="none"
        className="stroke-brand-300"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
    </Scene>
  );
}

/** Two tabs side by side: the board on the left, the Budget sheet on the right, one bar under both. */
export function SideBySideOpen() {
  return (
    <Scene w={440} h={230}>
      <BoardFragment
        x={6}
        y={6}
        w={256}
        h={176}
        types={[{ name: 'Task', icon: 'task', hue: 'teal' }]}
        columns={[
          { name: 'To Do', cards: [{ type: 'story', num: 6, title: 'Sync icon' }] },
          { name: 'Doing', cards: [{ type: 'task', num: 14, title: 'Currency' }] },
        ]}
      />
      {/* The right pane: a Sheet keeps its floating cards. */}
      <rect x={268} y={6} width={166} height={176} rx={8} className="fill-slate-50" />
      <ChromeCard x={274} y={14} w={154} h={113} r={6} lift={false}>
        <SheetFragment
          x={274.5}
          y={14.5}
          cols={[50, 46, 40]}
          rows={BUDGET_ROWS}
          rh={16}
          sel={[1, 2]}
        />
      </ChromeCard>
      <line x1={265} y1={10} x2={265} y2={178} className="stroke-slate-300" strokeWidth={HAIR} />
      <BottomBar y={194} w={440} tabs={PLAN_TABS} active={1} getStarted={false} />
      {/* The Budget tab is open too: its name in the accent, underlined. */}
      {(() => {
        const l = barTabLefts(PLAN_TABS, 1)[2]!;
        const w = barTabW(PLAN_TABS[2]!, false);
        return (
          <rect
            x={l + 6}
            y={194 + BAR_H - 3}
            width={w - 12}
            height={1.5}
            rx={0.75}
            className="fill-brand-500"
          />
        );
      })()}
    </Scene>
  );
}

/** The appearance switch at the right-hand end of the bottom bar, stepping Light, Dark, System on each click. */
export function LightDarkToggle() {
  const steps: { name: string; glyph: 'sun' | 'moon' | 'monitor' }[] = [
    { name: 'Light', glyph: 'sun' },
    { name: 'Dark', glyph: 'moon' },
    { name: 'System', glyph: 'monitor' },
  ];
  return (
    <Scene w={420} h={170}>
      {steps.map((s, i) => {
        const x = 60 + i * 110;
        return (
          <g key={s.name}>
            <ChromeCard x={x} y={34} w={80} h={26} r={6} />
            <Glyph name={s.glyph} x={x + 16} y={47} brand={i === 2} />
            <Label x={x + 28} y={47.5} size={10} weight={500} tone={i === 2 ? 'accent' : 'strong'}>
              {s.name}
            </Label>
            {i < 2 && (
              <path
                d={`M${x + 86} 47 h20 M${x + 101} 43 l5 4 l-5 4`}
                fill="none"
                className="stroke-slate-400"
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}
      <path
        d="M320 64 V82 H100 V64 M96 68 l4 -4 l4 4"
        fill="none"
        className="stroke-slate-300"
        strokeWidth={0.75}
        strokeDasharray="3 2"
      />
      <Label x={210} y={94} size={9} anchor="middle" tone="muted">
        Each click moves to the next setting
      </Label>
      <BottomBar y={130} w={420} tabs={[{ name: 'Sprint 12', kind: 'board' }]} getStarted={false} />
      {/* The switch itself, ringed. */}
      <circle cx={409} cy={144} r={9} fill="none" className="stroke-brand-400" strokeWidth={1} />
    </Scene>
  );
}
