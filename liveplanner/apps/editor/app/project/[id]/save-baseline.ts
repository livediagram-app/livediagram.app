import type { Tab } from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';

// The autosave's baseline (`lastSavedTabsRef` + `lastSavedNameRef`) is the
// "before" of both diffs a save makes: which tabs to PUT, and which ops to
// broadcast. It has to mean "what peers and D1 already have", so a peer's op
// is folded into it as well as into the tabs on screen (docs/specs/012-collaboration/collab-race-hardening.md). Otherwise
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
  if (op.kind === 'project-meta') refs.name.current = op.name;
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
    if (op.kind === 'project-meta') name = op.name;
  }
  return { tabs, name };
}

// How long a save's window stays open after it lands (docs/specs/012-collaboration/collab-race-hardening.md "A save
// that wrote over a peer's change writes again"). A peer's element op is sent only after their own write lands, so
// it can reach us a round trip after ours did. Safe range: 500 ms to 5 s; longer only costs a few journal entries.
export const SAVE_RESAVE_GRACE_MS = 1500;

// The tabs this save wrote that a peer's element change reached after the save's snapshot: what we wrote of those
// may be older than what D1 last had from the peer, so each is written again (content only, no ops).
export function tabsChangedByPeersSince(
  journal: RemoteOpJournal,
  mark: number,
  savedTabIds: ReadonlySet<string>,
): string[] {
  const touched = new Set<string>();
  for (const { n, op } of journal.entries) {
    if (n <= mark) continue;
    if (
      (op.kind === 'el' ||
        op.kind === 'tab' ||
        op.kind === 'tab-meta' ||
        op.kind === 'dashboard-delta') &&
      savedTabIds.has(op.tabId)
    ) {
      touched.add(op.tabId);
    }
  }
  return [...touched];
}
