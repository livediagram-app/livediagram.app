import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/diagram';
import type { RoomOp } from '@livediagram/api-schema';
import { computeTabSaveDiff } from './editor-page-helpers';
import { applyRoomOpToTabs } from './room-op-apply';
import {
  baselineAfterSave,
  closeSaveWindow,
  createRemoteOpJournal,
  foldRemoteOpIntoBaseline,
  openSaveWindow,
  type SaveBaselineRefs,
} from './save-baseline';
import { tabBroadcastOps } from './tab-broadcast-ops';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const tab = (elements: Element[]): Tab => ({ id: 't1', name: 'Tab 1', elements });

const peerMoves = (id: string, x: number): RoomOp => ({
  kind: 'el',
  tabId: 't1',
  op: { kind: 'update', element: el(id, { x }) },
});

// One participant's view of the world: what is on screen, and the baseline.
function client(start: Tab[]) {
  const refs: SaveBaselineRefs = {
    tabs: { current: start },
    name: { current: 'D' },
    journal: { current: createRemoteOpJournal() },
  };
  let screen = start;
  return {
    refs,
    get screen() {
      return screen;
    },
    edit(map: (tabs: Tab[]) => Tab[]) {
      screen = map(screen);
    },
    // What useRoomConnection does with a peer's op.
    receive(op: RoomOp) {
      screen = applyRoomOpToTabs(screen, op);
      foldRemoteOpIntoBaseline(refs, op);
    },
    diff() {
      return computeTabSaveDiff(refs.tabs.current, screen, refs.name.current, 'D');
    },
  };
}

describe('save baseline (spec/152)', () => {
  it("a peer's change alone is not a local change: nothing to save or echo", () => {
    const c = client([tab([el('a'), el('b')])]);
    c.receive(peerMoves('b', 50));
    expect(c.diff().hasChanges).toBe(false);
  });

  // THE bugs: a peer's op arriving inside the debounce used to cancel our
  // save, and the next save re-broadcast the peer's element from a baseline
  // that never saw it.
  it("our press survives a peer's op and broadcasts only what we changed", () => {
    const c = client([tab([el('a'), el('b')])]);
    c.edit((ts) => [{ ...ts[0]!, elements: [el('a', { x: 7 }), ts[0]!.elements[1]!] }]);
    c.receive(peerMoves('b', 50));
    const { changedTabs, hasChanges } = c.diff();
    expect(hasChanges).toBe(true);
    const ops = tabBroadcastOps(c.refs.tabs.current[0], changedTabs[0]!);
    expect(ops).toEqual([
      { kind: 'el', tabId: 't1', op: { kind: 'update', element: el('a', { x: 7 }) } },
    ]);
  });

  it('a save landing re-folds the peer ops that arrived while it was in flight', () => {
    const c = client([tab([el('a'), el('b')])]);
    c.edit((ts) => [{ ...ts[0]!, elements: [el('a', { x: 7 }), ts[0]!.elements[1]!] }]);
    const journal = c.refs.journal.current;
    const mark = openSaveWindow(journal);
    const snapshot = c.screen;
    // During the PUT, a peer moves b.
    c.receive(peerMoves('b', 50));
    const next = baselineAfterSave(journal, mark, snapshot, 'D');
    closeSaveWindow(journal);
    c.refs.tabs.current = next.tabs;
    // Resetting to the bare snapshot would make b look like OUR change and
    // ship the old b back over the peer's.
    expect(c.diff().hasChanges).toBe(false);
    expect(journal.entries).toEqual([]);
  });

  it('a peer rename is folded into the saved name', () => {
    const c = client([tab([el('a')])]);
    c.receive({
      kind: 'diagram-meta',
      name: 'Renamed',
      tabs: [{ id: 't1', name: 'Tab 1', orderIndex: 0 }],
    });
    expect(c.refs.name.current).toBe('Renamed');
  });
});
