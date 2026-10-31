import { describe, expect, it } from 'vitest';
import {
  insertDashboardSlot,
  moveDashboardDivider,
  removeDashboardSlot,
  setDashboardBackground,
  setDashboardContent,
  setDashboardRowHeight,
  addDashboardRow,
  type DashboardLayout,
} from './dashboard';
import { dashboardPatch, type DashboardPatch } from './dashboard-patch';
import {
  DASHBOARD_LEDGER_IDS_MAX,
  dashboardLedgerPatchSince,
  mergeDashboardLedger,
  recordDashboardPatch,
  recordDashboardReset,
  type DashboardLedger,
} from './dashboard-ledger';
import { ledgerKey, mergeLedgerIntoTab, recordInLedger, tabLedgerFrom } from './collab-ledger';
import type { Tab } from './index';

// docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's layout travels as deltas": the ledger keeps
// the room's layout changes so a save the saver snapshotted earlier still holds them.

const layout = (): DashboardLayout => ({
  rows: [
    {
      id: 'r1',
      height: 320,
      slots: [
        { id: 's1', span: 6 },
        { id: 's2', span: 6, content: { type: 'note', title: 'Note', text: '' } },
      ],
    },
    { id: 'r2', height: 320, slots: [{ id: 's3', span: 12 }] },
  ],
});

const patchOf = (before: DashboardLayout, after: DashboardLayout): DashboardPatch =>
  dashboardPatch(before, after)!;

// A room: each patch recorded at the next seq.
const record = (patches: DashboardPatch[], from?: DashboardLedger, seq0 = 0) => {
  let ledger = from;
  patches.forEach((p, i) => {
    ledger = recordDashboardPatch(ledger, p, seq0 + i + 1) ?? ledger;
  });
  return ledger!;
};

describe('recordDashboardPatch', () => {
  it('refuses a malformed patch', () => {
    expect(recordDashboardPatch(undefined, { rows: [] }, 1)).toBeNull();
  });

  it('keeps each field’s latest value with the seq that set it', () => {
    const base = layout();
    const ledger = record([
      patchOf(base, setDashboardRowHeight(base, 'r1', 400)),
      patchOf(base, setDashboardRowHeight(base, 'r1', 500)),
      patchOf(base, setDashboardBackground(base, 'tint')),
    ]);
    expect(ledger.rows['r1']!.set).toEqual({ height: { value: 500, seq: 2 } });
    expect(ledger.set).toEqual({ background: { value: 'tint', seq: 3 } });
  });

  it('keeps only the seq of a removal, and drops per-field content entries a whole content replaces', () => {
    const base = layout();
    const retitled = setDashboardContent(base, 's2', { type: 'note', title: 'A', text: '' });
    const ledger = record([
      patchOf(base, retitled),
      patchOf(retitled, setDashboardContent(retitled, 's2', undefined)),
      patchOf(base, removeDashboardSlot(base, 'r2', 's3')),
    ]);
    expect(ledger.slots['s2']!.set).toEqual({ content: { cleared: true, seq: 2 } });
    expect(ledger.slots['s3']).toEqual({ removed: 3 });
    expect(ledger.rows['r2']).toEqual({ removed: 3 });
  });

  it('records added rows and slots whole, row lists and the order', () => {
    const base = layout();
    const withSlot = insertDashboardSlot(base, 'r2', 1, () => 'new');
    const withRow = addDashboardRow(base, () => 'r3');
    const ledger = record([patchOf(base, withSlot), patchOf(base, withRow)]);
    expect(ledger.slots['new']!.added).toEqual({ row: 'r2', slot: { id: 'new', span: 6 }, seq: 1 });
    expect(ledger.rows['r2']!.slots).toEqual({ ids: ['s3', 'new'], seq: 1 });
    expect(ledger.rows['r3']!.added!.seq).toBe(2);
    expect(ledger.order).toEqual({ ids: ['r1', 'r2', 'r3'], seq: 2 });
  });

  it('forgets the oldest removals past the bound, then stops tracking new ids', () => {
    const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);
    const half = DASHBOARD_LEDGER_IDS_MAX / 2;
    let ledger = recordDashboardPatch(
      undefined,
      { removeRows: ['gr'], removeSlots: ids(half - 1, 'gone') },
      1,
    );
    ledger = recordDashboardPatch(ledger!, { removeSlots: ids(half, 'more') }, 1);
    expect(Object.keys(ledger!.slots)).toHaveLength(DASHBOARD_LEDGER_IDS_MAX - 1);
    ledger = recordDashboardPatch(ledger!, { removeRows: ['late', 'late2'] }, 2);
    expect(ledger!.rows['gr']).toBeUndefined();
    expect(ledger!.slots['gone0']).toBeUndefined();
    expect(ledger!.slots['gone1']).toEqual({ removed: 1 });
    expect(ledger!.rows['late']).toEqual({ removed: 2 });
    const live = (p: string) =>
      Object.fromEntries(ids(half, p).map((id) => [id, { set: { span: 2 } }]));
    const full = recordDashboardPatch(
      recordDashboardPatch(undefined, { slots: live('a') }, 3)!,
      { slots: live('b') },
      4,
    );
    expect(recordDashboardPatch(full!, { slots: { one: { set: { span: 2 } } } }, 5)).toBeNull();
  });
});

describe('recordDashboardReset', () => {
  it('keeps only the whole layout; anything else is no reset', () => {
    expect(recordDashboardReset(layout(), 5)).toEqual({
      reset: { layout: layout(), seq: 5 },
      set: {},
      rows: {},
      slots: {},
    });
    expect(recordDashboardReset(null, 5)).toBeNull();
    expect(recordDashboardReset({ rows: 'x' }, 5)).toBeNull();
  });
});

describe('dashboardLedgerPatchSince', () => {
  it('names only what came after the cursor, and re-adds only what the save lacks', () => {
    const base = layout();
    const withSlot = insertDashboardSlot(base, 'r2', 1, () => 'new');
    const ledger = record([
      patchOf(base, setDashboardRowHeight(base, 'r1', 400)),
      patchOf(base, withSlot),
      patchOf(base, setDashboardBackground(base, 'tint')),
      patchOf(setDashboardBackground(base, 'tint'), base),
      { removeRows: ['old'], removeSlots: ['olds'] },
    ]);
    const has = { rows: new Set(['r1', 'r2']), slots: new Set(['s1', 's2', 's3']) };
    expect(dashboardLedgerPatchSince(ledger, 5, has)).toBeNull();
    expect(dashboardLedgerPatchSince(record([{ set: { background: 'tint' } }]), 0, has)).toEqual({
      set: { background: 'tint' },
    });
    expect(dashboardLedgerPatchSince(ledger, 1, has)).toEqual({
      clear: ['background'],
      rowSlots: { r2: ['s3', 'new'] },
      addSlots: [{ row: 'r2', slot: { id: 'new', span: 6 } }],
      slots: { s3: { set: { span: 6 } } },
      removeRows: ['old'],
      removeSlots: ['olds'],
    });
    const hasNew = { rows: has.rows, slots: new Set([...has.slots, 'new']) };
    expect(dashboardLedgerPatchSince(ledger, 1, hasNew)!.addSlots).toBeUndefined();
    expect(dashboardLedgerPatchSince(ledger, 0, has)!.rows).toEqual({
      r1: { set: { height: 400 } },
    });
  });

  it('re-adds a row the save lacks, never one it has, and leaves out removals it had seen', () => {
    const base = layout();
    const ledger = record([
      patchOf(
        base,
        addDashboardRow(base, () => 'r3'),
      ),
      { removeRows: ['x'] },
    ]);
    const has = { rows: new Set(['r1', 'r2']), slots: new Set<string>() };
    expect(dashboardLedgerPatchSince(ledger, 0, has)!.addRows!.map((r) => r.id)).toEqual(['r3']);
    expect(dashboardLedgerPatchSince(ledger, 1, has)).toEqual({ removeRows: ['x'] });
    const hasIt = { rows: new Set(['r1', 'r2', 'r3']), slots: new Set<string>() };
    expect(dashboardLedgerPatchSince(ledger, 0, hasIt)!.addRows).toBeUndefined();
    expect(
      dashboardLedgerPatchSince({ ...ledger, slots: { gone: { removed: 1 } } }, 1, has),
    ).toEqual({
      removeRows: ['x'],
    });
  });
});

describe('mergeDashboardLedger', () => {
  it('folds in a peer’s change the saver had not seen, keeping the saver’s own', () => {
    const base = layout();
    // The peer's row resize reached the room at seq 1; the saver snapshotted at 0 and moved a divider.
    const ledger = record([patchOf(base, setDashboardRowHeight(base, 'r2', 340))]);
    const saved = moveDashboardDivider(base, 'r1', 0, -1);
    const merged = mergeDashboardLedger(saved, ledger, 0) as DashboardLayout;
    expect(merged.rows[1]!.height).toBe(340);
    expect(merged.rows[0]!.slots.map((s) => s.span)).toEqual([5, 7]);
    expect(mergeDashboardLedger(saved, ledger, 1)).toBe(saved);
  });

  it('takes a reset the saver had not seen, then every change after it', () => {
    const base = layout();
    const rebuilt: DashboardLayout = {
      rows: [{ id: 'z', height: 200, slots: [{ id: 'zs', span: 12 }] }],
    };
    let ledger = recordDashboardReset(rebuilt, 3)!;
    ledger = recordDashboardPatch(
      ledger,
      patchOf(rebuilt, setDashboardRowHeight(rebuilt, 'z', 260)),
      4,
    )!;
    const merged = mergeDashboardLedger(base, ledger, 2) as DashboardLayout;
    expect(merged.rows).toEqual([{ id: 'z', height: 260, slots: [{ id: 'zs', span: 12 }] }]);
    expect(mergeDashboardLedger(rebuilt, recordDashboardReset(rebuilt, 3)!, 2)).toBe(rebuilt);
  });

  it('leaves a save with no layout, or nothing to fold, as it is', () => {
    const base = layout();
    expect(mergeDashboardLedger(undefined, record([{ order: ['r2', 'r1'] }]), 0)).toBeUndefined();
    expect(mergeDashboardLedger(base, undefined, 0)).toBe(base);
    const odd = { rows: [null, { id: 'r1', slots: [null, { id: 's1' }] }, { slots: 'x' }] };
    expect(
      mergeDashboardLedger(odd, record([{ rows: { r1: { set: { height: 400 } } } }]), 0),
    ).toMatchObject({
      rows: [{ id: 'r1', height: 400 }],
    });
  });
});

describe('the collaboration ledger', () => {
  const tab = (dashboard?: DashboardLayout): Tab => ({
    id: 't1',
    name: 'Dashboard',
    kind: 'dashboard',
    elements: [],
    ...(dashboard ? { dashboard } : {}),
  });

  it('keys a delta, a tab-meta with a whole layout and a rebuilding changeset by the tab', () => {
    const patch = { rows: { r1: { set: { height: 400 } } } };
    expect(ledgerKey({ kind: 'dashboard-delta', tabId: 't1', patch })).toBe('ledger:t1:dash');
    expect(ledgerKey({ kind: 'tab-meta', tabId: 't1', patch: { dashboard: layout() } })).toBe(
      'ledger:t1:dash',
    );
    expect(ledgerKey({ kind: 'changeset', tabId: 't1', dashboard: layout() })).toBe(
      'ledger:t1:dash',
    );
    expect(ledgerKey({ kind: 'tab-meta', tabId: 't1', patch: { name: 'x' } })).toBeNull();
    expect(ledgerKey({ kind: 'tab-meta', tabId: 't1', patch: null })).toBeNull();
    expect(ledgerKey({ kind: 'changeset', tabId: 't1' })).toBeNull();
    expect(ledgerKey({ kind: 'tab', tabId: 't1', dashboard: layout() })).toBeNull();
  });

  it('records each, reads it back from storage and merges it into a save', () => {
    const base = layout();
    const delta = {
      kind: 'dashboard-delta',
      tabId: 't1',
      patch: patchOf(base, setDashboardRowHeight(base, 'r2', 340)),
    };
    const stored = recordInLedger(undefined, delta, 1);
    const reset = recordInLedger(
      stored ?? undefined,
      { kind: 'tab-meta', tabId: 't1', patch: { dashboard: base } },
      2,
    );
    expect((reset as DashboardLedger).reset!.seq).toBe(2);
    const ledger = tabLedgerFrom('t1', [['ledger:t1:dash', stored]]);
    expect(ledger.dashboard).toBe(stored);
    const saved = tab(moveDashboardDivider(base, 'r1', 0, -1));
    const merged = mergeLedgerIntoTab(saved, ledger, 0);
    expect(merged.dashboard!.rows[1]!.height).toBe(340);
    expect(merged.dashboard!.rows[0]!.slots[0]!.span).toBe(5);
    expect(mergeLedgerIntoTab(saved, ledger, 1)).toBe(saved);
    expect(mergeLedgerIntoTab(tab(), ledger, 0)).toEqual(tab());
  });
});
