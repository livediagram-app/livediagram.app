// Edits to a board and what happens to them (troubleshooting/missing-changes): a save that did not reach the
// server, shown as the message at the bottom of the window, and Undo taking back a card's move. Both are a Board
// tab from ./board-fragment in the window's own chrome.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BoardFragment, fragCardAt, type FragColumn } from './board-fragment';
import { ChromeCard } from './planner-chrome';
import { CornerControls } from './planner-bars';
import { Card } from './plan-parts';

const COLUMNS: FragColumn[] = [
  { name: 'To Do', cards: [{ type: 'story', num: 6, title: 'Sync status icon' }] },
  {
    name: 'In Progress',
    cards: [
      { type: 'task', num: 14, title: 'Currency picker' },
      { type: 'story', num: 12, title: 'Offline banner' },
    ],
  },
  { name: 'Done', cards: [{ type: 'task', num: 3, title: 'Login page' }] },
];

/** A save that did not reach the server: the board stays as you left it, and the message at the bottom of the
 *  window says so while autosave keeps retrying. */
export function SaveFailedToast() {
  return (
    <Scene w={420} h={220}>
      <BoardFragment x={6} y={6} w={408} h={208} columns={COLUMNS} />
      <ChromeCard x={56} y={166} w={308} h={30} r={8} />
      <circle cx={74} cy={181} r={6.5} className="fill-rose-500 dark:fill-rose-700" />
      <path
        d="M74 177.5 V181.5 M74 184 V184.4"
        className="stroke-white help-art-as-drawn"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Label x={86} y={181.5} size={9.5} weight={600} className="fill-rose-700 dark:fill-rose-300">
        Couldn&rsquo;t save your changes. Check your connection.
      </Label>
    </Scene>
  );
}

/** Undo taking back a move: the card dropped in Done goes back to In Progress (its old place outlined), from the
 *  corner cluster's Undo or ⌘Z. */
export function UndoStep() {
  const frag = { x: 6, y: 6, w: 408, columns: 3 };
  const from = fragCardAt(frag, 2, 1);
  const to = fragCardAt(frag, 1, 1);
  const cols: FragColumn[] = [
    COLUMNS[0]!,
    { name: 'In Progress', cards: [COLUMNS[1]!.cards[0]!] },
    { name: 'Done', cards: COLUMNS[2]!.cards },
  ];
  return (
    <Scene w={420} h={220}>
      <BoardFragment x={6} y={6} w={408} h={208} columns={cols} addCard={false} />
      {/* Where Undo puts it back. */}
      <rect
        x={to.x}
        y={to.y}
        width={to.w}
        height={to.h}
        rx={4}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <Card
        x={from.x}
        y={from.y}
        w={from.w}
        face="full"
        type="story"
        num={12}
        title="Offline banner"
        selected
      />
      <path
        d={`M${from.x - 2} ${from.y + 17} C ${from.x - 14} ${from.y + 17}, ${to.x + to.w + 14} ${to.y + 17}, ${to.x + to.w + 3} ${to.y + 17}`}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.2}
      />
      <path
        d={`M${to.x + to.w + 7} ${to.y + 13} l-4 4 l4 4`}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* The ⌘Z key beside the cluster, whose Undo is lit. */}
      <ChromeCard x={232} y={180} w={28} h={18} r={4} />
      <Label x={246} y={189.5} size={9} weight={600} anchor="middle" tone="strong">
        ⌘Z
      </Label>
      <CornerControls right={408} y={214 - 28} groups={['undo', 'board', 'settings']} undoLit />
    </Scene>
  );
}
