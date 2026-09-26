import type { Tab } from '@livediagram/diagram';
import type { RoomOp } from '@livediagram/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';

// The autosave's baseline (`lastSavedTabsRef` + `lastSavedNameRef`) is the
// "before" of both diffs a save makes: which tabs to PUT, and which ops to
// broadcast. It has to mean "what peers and D1 already have", so a peer's op
// is folded into it as well as into the tabs on screen (spec/152). Otherwise
// the next local save sees the peer's change as ours and ships it back out in
// our older copy.
//
// The one subtlety is a save in flight. It snapshots the tabs, PUTs, and on
// success resets the baseline to that snapshot, which predates any op that
// arrived meanwhile. So ops are journalled while at least one save is open,
// and a save that lands re-folds the ones that came after its snapshot.

export type RemoteOpJournal = {
  // Monotonic count of ops recorded; a save's mark is the value at snapshot.
  next: number;
  entries: { n: number; op: RoomOp }[];
  // Saves currently in flight. Nothing is kept while this is zero.
  open: number;
};

export function createRemoteOpJournal(): RemoteOpJournal {
  return { next: 0, entries: [], open: 0 };
}

// A save is taking its snapshot: returns the mark its re-fold starts after.
export function openSaveWindow(journal: RemoteOpJournal): number {
  journal.open++;
  return journal.next;
}

// A save finished (either way). The journal empties once none are open.
export function closeSaveWindow(journal: RemoteOpJournal): void {
  journal.open = Math.max(0, journal.open - 1);
  if (journal.open === 0) journal.entries = [];
}

export type SaveBaselineRefs = {
  tabs: { current: Tab[] };
  name: { current: string };
  journal: { current: RemoteOpJournal };
};

// A peer's op has been applied on screen: apply it to the baseline too, and
// journal it if a save is in flight.
export function foldRemoteOpIntoBaseline(refs: SaveBaselineRefs, op: RoomOp): void {
  refs.tabs.current = applyRoomOpToTabs(refs.tabs.current, op);
  if (op.kind === 'diagram-meta') refs.name.current = op.name;
  const journal = refs.journal.current;
  journal.next++;
  if (journal.open > 0) journal.entries.push({ n: journal.next, op });
}

// The baseline a successful save leaves behind: its own snapshot, plus every
// peer op that arrived after the snapshot was taken.
export function baselineAfterSave(
  journal: RemoteOpJournal,
  mark: number,
  savedTabs: Tab[],
  savedName: string,
): { tabs: Tab[]; name: string } {
  let tabs = savedTabs;
  let name = savedName;
  for (const { n, op } of journal.entries) {
    if (n <= mark) continue;
    tabs = applyRoomOpToTabs(tabs, op);
    if (op.kind === 'diagram-meta') name = op.name;
  }
  return { tabs, name };
}
