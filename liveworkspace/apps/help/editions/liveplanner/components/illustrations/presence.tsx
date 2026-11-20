// Working together on a plan (collaboration/live-presence, the session tools, one-tab links,
// troubleshooting/collaboration-issues): a real board with other people's cursors on its cards, a dot vote cast on
// cards with the Session strip in the corner cluster, and a visitor on a one-tab link. Every scene is a Board tab
// from ./board-fragment in the window's own chrome (./planner-chrome).

import { Cursor, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BoardFragment, fragCardAt, type FragColumn } from './board-fragment';
import { HAIR } from './planner-chrome';
import { BottomBar, CornerControls } from './planner-bars';
import { Glyph } from './planner-glyphs';

const SPRINT: FragColumn[] = [
  {
    name: 'To Do',
    cards: [
      { type: 'story', num: 6, title: 'Sync status icon', priority: 'Medium' },
      { type: 'task', num: 8, title: 'Retry queue', priority: 'High' },
    ],
  },
  {
    name: 'In Progress',
    count: '2 / 3',
    cards: [
      { type: 'story', num: 12, title: 'Offline banner', priority: 'High' },
      { type: 'task', num: 14, title: 'Currency picker' },
    ],
  },
  { name: 'Review', cards: [{ type: 'task', num: 11, title: 'Budget totals', priority: 'Low' }] },
];

/** Three people on one board: each cursor carries its owner's name and colour, one of them holding a card, and the
 *  open tab in the bottom bar stacks their initials. */
export function LiveCursors() {
  const frag = { x: 6, y: 6, w: 408, columns: 3 };
  const a = fragCardAt(frag, 0, 1);
  const b = fragCardAt(frag, 1, 0);
  const c = fragCardAt(frag, 2, 0);
  return (
    <Scene w={420} h={250}>
      <BoardFragment x={6} y={6} w={408} h={208} columns={SPRINT} />
      {/* Jae has the Offline banner card selected: their colour rings it. */}
      <rect
        x={b.x - 1.5}
        y={b.y - 1.5}
        width={b.w + 3}
        height={b.h + 3}
        rx={5}
        fill="none"
        className="stroke-violet-500"
        strokeWidth={1.5}
      />
      <Cursor x={a.x + 70} y={a.y + 20} name="Aria" colour="rose" />
      <Cursor x={b.x + 92} y={b.y + 26} name="Jae" colour="violet" />
      <Cursor x={c.x + 40} y={c.y + 46} name="Mara" colour="emerald" />
      <BottomBar
        y={226}
        w={420}
        getStarted={false}
        tabs={[
          { name: 'Sprint 12', kind: 'board' },
          { name: 'Backlog', kind: 'board' },
          { name: 'Budget', kind: 'sheet' },
        ]}
        presence={[
          { initial: 'A', colour: 'rose' },
          { initial: 'J', colour: 'violet' },
          { initial: 'M', colour: 'emerald' },
        ]}
      />
    </Scene>
  );
}

const RETRO: FragColumn[] = [
  {
    name: 'To Improve',
    cards: [
      { type: 'idea', num: 3, title: 'Reduce WIP' },
      { type: 'idea', num: 5, title: 'Pair more' },
      { type: 'idea', num: 7, title: 'Shorter standup' },
    ],
  },
  {
    name: 'Actions',
    cards: [
      { type: 'action', num: 9, title: 'Auto tests' },
      { type: 'action', num: 10, title: 'Release notes' },
    ],
  },
];

/** A card's vote stepper in its top-right corner: take back, the count, cast. `mine` tints it (your dots are on
 *  it). */
export function VoteStepper({
  right,
  y,
  count,
  mine = false,
}: {
  right: number;
  y: number;
  count: number | string;
  mine?: boolean;
}) {
  const x = right - 38;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={38}
        height={13}
        rx={6.5}
        className={mine ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
        strokeWidth={HAIR}
      />
      <path
        d={`M${x + 5} ${y + 6.5} h4`}
        className="stroke-slate-500"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Label
        x={x + 19}
        y={y + 7}
        size={9}
        weight={700}
        anchor="middle"
        className={mine ? 'fill-brand-700' : 'fill-slate-700'}
      >
        {count}
      </Label>
      <Glyph name="plus" x={x + 31} y={y + 6.5} s={0.5} className="stroke-slate-500" />
    </g>
  );
}

/** A dot vote on a retro board: every card carries its vote stepper, and the corner cluster's Session strip lights
 *  the Vote button with your dots left. With `clock`, the Timer beside it shows the countdown too. */
function BoardVote({ clock }: { clock?: string }) {
  const frag = { x: 6, y: 6, w: 408, columns: 2 };
  const counts: [number, number, number | string, boolean][] = [
    [0, 0, 4, true],
    [0, 1, 1, false],
    [0, 2, 0, false],
    [1, 0, 2, true],
    [1, 1, 0, false],
  ];
  return (
    <Scene w={420} h={250}>
      <BoardFragment
        x={6}
        y={6}
        w={408}
        h={208}
        title="Retro"
        types={[
          { name: 'Idea', icon: 'initiative', hue: 'amber' },
          { name: 'Action', icon: 'action', hue: 'rose' },
        ]}
        columns={RETRO}
        addCard={false}
      />
      {counts.map(([col, row, n, mine]) => {
        const at = fragCardAt(frag, col, row);
        return (
          <VoteStepper
            key={`${col}-${row}`}
            right={at.x + at.w - 5}
            y={at.y + 5}
            count={n}
            mine={mine}
          />
        );
      })}
      <CornerControls
        right={408}
        y={214 - 28}
        groups={['undo', 'session', 'board', 'settings']}
        dotsLeft={2}
        clock={clock}
      />
      <BottomBar
        y={226}
        w={420}
        getStarted={false}
        tabs={[
          { name: 'Retro', kind: 'board' },
          { name: 'Actions', kind: 'sheet' },
        ]}
      />
    </Scene>
  );
}

/** Casting dots: each card's stepper and the lit Vote button counting your dots left. */
export function DotVoting() {
  return <BoardVote />;
}

/** A vote in progress with the Timer's clock running beside the lit Vote button. */
export function SessionTools() {
  return <BoardVote clock="4:32" />;
}

/** A visitor on a one-tab link: the shared Roadmap board, with Sign In for them, and every other tab in the bar
 *  shown as Not shared. */
export function OneTabShare() {
  return (
    <Scene w={420} h={250}>
      <BoardFragment
        x={6}
        y={6}
        w={408}
        h={208}
        title="Roadmap"
        types={[{ name: 'Initiative', icon: 'initiative', hue: 'indigo' }]}
        account
        columns={[
          {
            name: 'Now',
            cards: [
              { type: 'initiative', num: 1, title: 'Offline sync', priority: 'High' },
              { type: 'initiative', num: 2, title: 'Shared budgets', priority: 'Medium' },
            ],
          },
          { name: 'Next', cards: [{ type: 'initiative', num: 3, title: 'Guided first list' }] },
          { name: 'Later', cards: [{ type: 'initiative', num: 4, title: 'Home-screen widget' }] },
        ]}
        addCard={false}
      />
      <BottomBar
        y={226}
        w={420}
        controls={false}
        active={1}
        tabs={[
          { name: 'Not shared', kind: 'board', notShared: true },
          { name: 'Roadmap', kind: 'board' },
          { name: 'Not shared', kind: 'sheet', notShared: true },
          { name: 'Not shared', kind: 'dashboard', notShared: true },
        ]}
      />
    </Scene>
  );
}
