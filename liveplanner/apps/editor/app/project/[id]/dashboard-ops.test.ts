import { describe, expect, it, vi } from 'vitest';
import {
  setDashboardRowHeight,
  type DashboardLayout,
  type Element,
  type Tab,
} from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import { EL_OP_BROADCAST_LIMIT, mergeRemoteTab, tabBroadcastOps } from './tab-broadcast-ops';
import { applyRoomOpToTabs } from './room-op-apply';
import { roomOpIsWellFormed } from './room-op-shape';
import { createRemoteOpJournal, openSaveWindow, tabsChangedByPeersSince } from './save-baseline';
import {
  createOwnElementWrites,
  holdOwnDashboardWrites,
  withoutOwnDashboardWrites,
} from './own-element-writes';
import { prepareTabSave, saveTabAndRelay, type SaveRoom } from './tab-save-flow';

// docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's layout travels as deltas": the editor's
// half, op by op.

const layout = (height = 320): DashboardLayout => ({
  rows: [
    {
      id: 'r1',
      height,
      slots: [
        { id: 's1', span: 6 },
        { id: 's2', span: 6 },
      ],
    },
  ],
});

const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Dash',
  kind: 'dashboard',
  elements: [],
  dashboard: layout(),
  ...over,
});

const box = (id: string, x = 0): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 10,
  height: 10,
});

const delta = (height: number, tabId = 't1'): RoomOp => ({
  kind: 'dashboard-delta',
  tabId,
  patch: { rows: { r1: { set: { height } } } },
});

describe('tabBroadcastOps and a layout', () => {
  it('sends a layout change as a delta, never in the tab-meta patch', () => {
    const before = tab();
    const ops = tabBroadcastOps(before, { ...before, name: 'Flow', dashboard: layout(400) });
    expect(ops).toEqual([{ kind: 'tab-meta', tabId: 't1', patch: { name: 'Flow' } }, delta(400)]);
  });

  it('sends a layout appearing or going whole, in the patch', () => {
    const none = tab({ dashboard: undefined, kind: undefined });
    expect(tabBroadcastOps(none, tab())).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { kind: 'dashboard', dashboard: layout() } },
    ]);
    expect(tabBroadcastOps(tab(), { ...none, kind: 'board' })).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { kind: 'board' }, clear: ['dashboard'] },
    ]);
  });

  it('marks a bulk whole-tab op so peers keep their own layout, and sends the delta beside it', () => {
    const before = tab();
    const many = Array.from({ length: EL_OP_BROADCAST_LIMIT + 1 }, (_, i) => box(`e${i}`));
    const ops = tabBroadcastOps(before, { ...before, elements: many, dashboard: layout(400) });
    expect(ops[0]).toMatchObject({ kind: 'tab', dashboardDeltas: true });
    expect(ops[1]).toEqual(delta(400));
    expect(tabBroadcastOps(undefined, before)[0]).not.toHaveProperty('dashboardDeltas');
  });
});

describe('a peer’s layout ops', () => {
  it('applies a delta by row and slot id, only onto a layout this editor has', () => {
    const tabs = [tab()];
    expect(applyRoomOpToTabs(tabs, delta(400))[0]!.dashboard!.rows[0]!.height).toBe(400);
    expect(applyRoomOpToTabs(tabs, delta(320))).toBe(tabs);
    const plain = [tab({ dashboard: undefined })];
    expect(applyRoomOpToTabs(plain, delta(400))).toBe(plain);
    expect(applyRoomOpToTabs(tabs, delta(400, 'other'))).toBe(tabs);
  });

  it('applies one delta once per shared tab, so undo snapshots keep sharing one layout', () => {
    const shared = tab();
    const op = delta(400);
    const snapshots = Array.from({ length: 500 }, () => [shared]);
    const out = snapshots.map((tabs) => applyRoomOpToTabs(tabs, op)[0]);
    expect(new Set(out).size).toBe(1);
    expect(out[0]!.dashboard!.rows[0]!.height).toBe(400);
  });

  it('keeps its own layout through a flagged whole tab, and takes an older editor’s whole', () => {
    const mine = tab({ dashboard: layout(500) });
    const theirs = tab({ dashboard: layout(200) });
    expect(mergeRemoteTab(mine, theirs, { dashboardDeltas: true }).dashboard).toBe(mine.dashboard);
    expect(mergeRemoteTab(mine, theirs).dashboard).toBe(theirs.dashboard);
    const gone = tab({ dashboard: undefined });
    expect(mergeRemoteTab(mine, gone, { dashboardDeltas: true }).dashboard).toBeUndefined();
    const flagged = applyRoomOpToTabs([mine], {
      kind: 'tab',
      tabId: 't1',
      tab: theirs,
      dashboardDeltas: true,
    });
    expect(flagged[0]!.dashboard).toBe(mine.dashboard);
  });

  it('takes the layout an agent rebuilt whole', () => {
    const rebuilt = layout(700);
    const next = applyRoomOpToTabs([tab()], {
      kind: 'changeset',
      tabId: 't1',
      id: 'c1',
      rev: 2,
      prevRev: 1,
      author: { name: 'Agent', color: '#000' },
      counts: { added: 0, changed: 0, removed: 0 },
      elementOps: [],
      dashboard: rebuilt,
    });
    expect(next[0]!.dashboard).toBe(rebuilt);
  });

  it('checks a delta’s and a changeset’s envelope', () => {
    expect(roomOpIsWellFormed(delta(400))).toBe(true);
    expect(roomOpIsWellFormed({ kind: 'dashboard-delta', tabId: 't1', patch: { rows: [] } })).toBe(
      false,
    );
    expect(roomOpIsWellFormed({ kind: 'dashboard-delta', patch: {} })).toBe(false);
    expect(roomOpIsWellFormed({ kind: 'changeset', tabId: 't1', dashboard: 'x' })).toBe(false);
    expect(roomOpIsWellFormed({ kind: 'changeset', tabId: 't1', dashboard: layout() })).toBe(true);
  });

  it('counts a peer’s layout change as one a save may have written over', () => {
    const journal = createRemoteOpJournal();
    const mark = openSaveWindow(journal);
    journal.entries.push({ n: mark + 1, op: delta(400) });
    expect(tabsChangedByPeersSince(journal, mark, new Set(['t1']))).toEqual(['t1']);
  });
});

describe('held layout fields', () => {
  it('leaves a held field out of a peer’s delta, the rest applying, until released', () => {
    const writes = createOwnElementWrites();
    const release = holdOwnDashboardWrites(writes, 't1', {
      rows: { r1: { set: { height: 400 } } },
    });
    const peer: RoomOp = {
      kind: 'dashboard-delta',
      tabId: 't1',
      patch: { rows: { r1: { set: { height: 200, fill: true } } } },
    };
    expect(withoutOwnDashboardWrites(writes, peer)).toEqual({
      ...peer,
      patch: { rows: { r1: { set: { fill: true } } } },
    });
    expect(withoutOwnDashboardWrites(writes, delta(200))).toBeNull();
    expect(withoutOwnDashboardWrites(writes, delta(200, 'other'))).toEqual(delta(200, 'other'));
    const other: RoomOp = { kind: 'tab-focus', tabId: 't1' };
    expect(withoutOwnDashboardWrites(writes, other)).toBe(other);
    release();
    release();
    expect(writes.held.size).toBe(0);
    const passes = delta(200);
    expect(withoutOwnDashboardWrites(writes, passes)).toBe(passes);
  });

  it('counts two holds of one field', () => {
    const writes = createOwnElementWrites();
    const patch = { rows: { r1: { set: { height: 400 } } } };
    const one = holdOwnDashboardWrites(writes, 't1', patch);
    const two = holdOwnDashboardWrites(writes, 't1', patch);
    one();
    expect(withoutOwnDashboardWrites(writes, delta(200))).toBeNull();
    two();
    expect(writes.held.size).toBe(0);
  });

  it('a save holds its delta’s fields from the snapshot until the room orders it', async () => {
    const writes = createOwnElementWrites();
    const before = tab();
    const after = { ...before, dashboard: layout(400) };
    const prepared = prepareTabSave(before, after, writes);
    expect(writes.held.size).toBe(1);
    let confirm: (ok: boolean) => void = () => {};
    const room: SaveRoom = {
      send: vi.fn(),
      sequence: vi.fn(() => new Promise<boolean>((resolve) => (confirm = resolve))),
    };
    const saving = saveTabAndRelay(
      before,
      after,
      () => room,
      () => Promise.resolve(1),
      prepared,
    );
    await Promise.resolve();
    expect(writes.held.size).toBe(1);
    confirm(true);
    await saving;
    expect(writes.held.size).toBe(0);
  });

  it('a save with no room holds nothing', async () => {
    const writes = createOwnElementWrites();
    const before = tab();
    const after = { ...before, dashboard: layout(400) };
    const prepared = prepareTabSave(before, after, writes);
    await saveTabAndRelay(
      before,
      after,
      () => null,
      () => Promise.resolve(1),
      prepared,
    );
    expect(writes.held.size).toBe(0);
    expect(prepareTabSave(before, { ...before, name: 'x' }, writes).releaseLayout).toBeNull();
  });

  it('measures smaller than the whole layout it replaces', () => {
    const before = tab();
    const after = { ...before, dashboard: setDashboardRowHeight(layout(), 'r1', 340) };
    const [op] = tabBroadcastOps(before, after);
    expect(op!.kind).toBe('dashboard-delta');
  });
});
