import { describe, expect, it } from 'vitest';
import {
  insertDashboardSlot,
  ledgerKey,
  mergeLedgerIntoTab,
  moveDashboardDivider,
  readDashboard,
  recordInLedger,
  setDashboardContent,
  setDashboardRowHeight,
  tabLedgerFrom,
  type DashboardLayout,
  type Tab,
} from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import {
  historyApplyRemoteOp,
  historyCommit,
  historyRedo,
  historyUndo,
  type History,
} from '@/hooks/canvas/useProjectHistory';
import { applyRoomOpToTabs } from './room-op-apply';
import {
  baselineAfterSave,
  closeSaveWindow,
  createRemoteOpJournal,
  foldRemoteOpIntoBaseline,
  openSaveWindow,
  type SaveBaselineRefs,
} from './save-baseline';
import { prepareTabSave, saveTabAndRelay, type SaveRoom } from './tab-save-flow';
import { createOwnElementWrites, withoutOwnDashboardWrites } from './own-element-writes';

// docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's layout travels as deltas": two editors on one
// Dashboard, each with its own screen, undo history, save baseline and held writes, through one room (which orders,
// relays and records into its ledger) and one store (which merges the ledger into each save, as the tab PUT does).
// Every hop is a timer tick, so two saves started together interleave as two real ones do.

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
// Let every frame in flight land.
const settle = async () => {
  for (let i = 0; i < 40; i += 1) await tick();
};

const start = (): Tab =>
  ({
    id: 'dash',
    name: 'Flow',
    kind: 'dashboard',
    elements: [],
    dashboard: {
      rows: [
        {
          id: 'r1',
          height: 320,
          slots: [
            { id: 's1', span: 6 },
            { id: 's2', span: 6 },
          ],
        },
        {
          id: 'r2',
          height: 320,
          slots: [
            { id: 's3', span: 6 },
            { id: 's4', span: 6 },
          ],
        },
      ],
    },
  }) as unknown as Tab;

type Client = ReturnType<typeof world>['join'] extends (n: string) => infer C ? C : never;

function world(initial: Tab) {
  let seq = 0;
  let stored = initial;
  const ledger = new Map<string, unknown>();
  const clients: { name: string; receive: (op: RoomOp, seq: number) => void }[] = [];
  // The room: a frame lands a tick after it is sent, takes the next seq, is recorded, relayed to everyone else and
  // confirmed to its sender a tick later. Each socket delivers in order, so a peer's op the room ordered first reaches
  // a sender before the confirmation of its own, as a WebSocket does.
  const toRoom = (from: string, op: RoomOp): Promise<number> =>
    new Promise((resolve) =>
      setTimeout(() => {
        seq += 1;
        const at = seq;
        const key = ledgerKey(op);
        if (key) {
          const next = recordInLedger(ledger.get(key) as never, op, at);
          if (next) ledger.set(key, next);
        }
        for (const c of clients) if (c.name !== from) setTimeout(() => c.receive(op, at), 0);
        setTimeout(() => resolve(at), 0);
      }, 0),
    );

  function join(name: string) {
    let history: History = { past: [], present: [structuredClone(stored)], future: [] };
    const refs: SaveBaselineRefs = {
      tabs: { current: [structuredClone(stored)] },
      name: { current: 'Plan' },
      journal: { current: createRemoteOpJournal() },
    };
    const writes = createOwnElementWrites();
    let seen = seq;
    const room: SaveRoom = {
      send: (msg) => {
        if (msg.kind === 'op') void toRoom(name, msg.op).then((at) => (seen = Math.max(seen, at)));
      },
      sequence: (op) =>
        toRoom(name, op).then((at) => {
          seen = Math.max(seen, at);
          return true;
        }),
    };
    const client = {
      name,
      // What this screen shows: the layout as every view draws it.
      layout: (): DashboardLayout => readDashboard(history.present[0]!.dashboard)!,
      edit: (change: (l: DashboardLayout) => DashboardLayout) => {
        history = historyCommit(history, (ts) =>
          ts.map((t) => ({ ...t, dashboard: change(readDashboard(t.dashboard)!) })),
        );
      },
      undo: () => {
        history = historyUndo(history);
      },
      redo: () => {
        history = historyRedo(history);
      },
      // The autosave: derive and hold at the snapshot, send the delta first, PUT (merged by the store), then
      // re-fold what arrived meanwhile.
      save: async () => {
        const tab = history.present[0]!;
        const before = refs.tabs.current[0]!;
        const mark = openSaveWindow(refs.journal.current);
        const cursor = seen;
        const prepared = prepareTabSave(before, tab, writes);
        await saveTabAndRelay(
          before,
          tab,
          () => room,
          () => {
            stored = mergeLedgerIntoTab(tab, tabLedgerFrom(tab.id, ledger.entries()), cursor);
            return Promise.resolve(stored);
          },
          prepared,
        );
        refs.tabs.current = baselineAfterSave(refs.journal.current, mark, [tab], 'Plan').tabs;
        closeSaveWindow(refs.journal.current);
      },
    };
    clients.push({
      name,
      // A peer's op, as useRoomConnection takes it: without the fields this editor still holds, then onto the
      // screen, every undo and redo snapshot and the baseline.
      receive: (received, at) => {
        seen = Math.max(seen, at);
        const op = withoutOwnDashboardWrites(writes, received);
        if (!op) return;
        history = historyApplyRemoteOp(history, (ts) => applyRoomOpToTabs(ts, op));
        foldRemoteOpIntoBaseline(refs, op);
      },
    });
    return client;
  }
  // A reload: what the store holds, as a fresh screen reads it.
  const reloaded = (): DashboardLayout => readDashboard(stored.dashboard)!;
  return { join, reloaded };
}

const spans = (l: DashboardLayout, row: number) => l.rows[row]!.slots.map((s) => s.span);

describe('two editors on one Dashboard', () => {
  it('the browser hunt: a row resize and a divider move at the same moment both survive, everywhere', async () => {
    const w = world(start());
    const owner = w.join('owner');
    const visitor = w.join('visitor');
    // Arrow Down on "Resize row 2"; Arrow Left on "Resize slots 1 and 2".
    owner.edit((l) => setDashboardRowHeight(l, 'r2', 340));
    visitor.edit((l) => moveDashboardDivider(l, 'r1', 0, -1));
    await Promise.all([owner.save(), visitor.save()]);
    await settle();

    for (const l of [owner.layout(), visitor.layout(), w.reloaded()]) {
      expect(l.rows[1]!.height).toBe(340);
      expect(spans(l, 0)).toEqual([5, 7]);
    }
  });

  it('each undo takes back only its own change, after the other person’s landed', async () => {
    const w = world(start());
    const owner = w.join('owner');
    const visitor = w.join('visitor');
    owner.edit((l) => setDashboardRowHeight(l, 'r2', 340));
    visitor.edit((l) => moveDashboardDivider(l, 'r1', 0, -1));
    await Promise.all([owner.save(), visitor.save()]);
    await settle();

    visitor.undo();
    expect(visitor.layout().rows[1]!.height).toBe(340);
    expect(spans(visitor.layout(), 0)).toEqual([6, 6]);
    await visitor.save();
    await settle();
    for (const l of [owner.layout(), visitor.layout(), w.reloaded()]) {
      expect(l.rows[1]!.height).toBe(340);
      expect(spans(l, 0)).toEqual([6, 6]);
    }

    owner.undo();
    await owner.save();
    await settle();
    for (const l of [owner.layout(), visitor.layout(), w.reloaded()]) {
      expect(l.rows[1]!.height).toBe(320);
      expect(spans(l, 0)).toEqual([6, 6]);
    }

    // Redo brings back only the visitor's own change too.
    visitor.redo();
    await visitor.save();
    await settle();
    for (const l of [owner.layout(), visitor.layout(), w.reloaded()]) {
      expect(l.rows[1]!.height).toBe(320);
      expect(spans(l, 0)).toEqual([5, 7]);
    }
  });

  it('the same row’s height pressed by both ends on one value on both screens and in the store', async () => {
    const w = world(start());
    const a = w.join('a');
    const b = w.join('b');
    a.edit((l) => setDashboardRowHeight(l, 'r1', 400));
    b.edit((l) => setDashboardRowHeight(l, 'r1', 200));
    await Promise.all([a.save(), b.save()]);
    await settle();

    const height = a.layout().rows[0]!.height;
    expect([200, 400]).toContain(height);
    expect(b.layout().rows[0]!.height).toBe(height);
    expect(w.reloaded().rows[0]!.height).toBe(height);
  });

  it('a slot filled, a slot added and a slot renamed by two people at once all land, and stay after a reload', async () => {
    const w = world(start());
    const a = w.join('a');
    const b = w.join('b');
    a.edit((l) => setDashboardContent(l, 's3', { type: 'note', title: 'Risks', text: '' }));
    b.edit((l) => insertDashboardSlot(l, 'r1', 2, () => 'added'));
    b.edit((l) => setDashboardContent(l, 's4', { type: 'tab', tabId: 'board', of: 'board' }));
    await Promise.all([a.save(), b.save()]);
    await settle();

    for (const l of [a.layout(), b.layout(), w.reloaded()]) {
      expect(l.rows[0]!.slots.map((s) => s.id)).toEqual(['s1', 's2', 'added']);
      expect(l.rows[1]!.slots[0]!.content).toEqual({ type: 'note', title: 'Risks', text: '' });
      expect(l.rows[1]!.slots[1]!.content).toEqual({ type: 'tab', tabId: 'board', of: 'board' });
    }
    expect(a.layout()).toEqual(b.layout());
    expect(w.reloaded()).toEqual(a.layout());
  });

  it('a later save from a person who had not seen a change keeps it in the store', async () => {
    const w = world(start());
    const a = w.join('a');
    const b = w.join('b');
    a.edit((l) => setDashboardRowHeight(l, 'r1', 500));
    // b snapshots before a's delta reaches it, and its save lands last.
    b.edit((l) => moveDashboardDivider(l, 'r2', 0, 2));
    const aSave = a.save();
    await tick();
    await Promise.all([aSave, b.save()]);
    await settle();
    expect(w.reloaded().rows[0]!.height).toBe(500);
    expect(spans(w.reloaded(), 1)).toEqual([8, 4]);
  });

  it('sends a layout change as a delta far smaller than the layout', () => {
    const before = start();
    const after = { ...before, dashboard: setDashboardRowHeight(before.dashboard!, 'r2', 340) };
    const ops = prepareTabSave(before, after).ops;
    expect(ops.map((o) => o.kind)).toEqual(['dashboard-delta']);
    expect(JSON.stringify(ops[0]).length).toBeLessThan(JSON.stringify(before.dashboard).length);
  });
});

// Keep the type of a joined client in one place for the helpers above.
export type { Client };
