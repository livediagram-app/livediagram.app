import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_NOTE_TITLE_MAX,
  DASHBOARD_ROWS_MAX,
  DASHBOARD_ROW_H_MAX,
  DASHBOARD_ROW_H_MIN,
  addDashboardRow,
  addDashboardSlot,
  dashboardElementIds,
  evenSpans,
  moveDashboardDivider,
  newDashboard,
  readDashboard,
  remapDashboardElements,
  remintDashboardIds,
  removeDashboardSlot,
  setDashboardContent,
  setDashboardRowHeight,
  type DashboardLayout,
} from './dashboard';
import { editorModeSwitchable, opensInOf, setTabOpensIn } from './editor-mode';
import { tabKindOf } from './tab-kind';

// docs/specs/026-plan/plan-tabs.md "Dashboard tab".
const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};
const spans = (l: DashboardLayout, r = 0) => l.rows[r]!.slots.map((s) => s.span);

describe('a dashboard layout', () => {
  it('starts as two rows of two empty slots', () => {
    const l = newDashboard(ids());
    expect(l.rows).toHaveLength(2);
    expect(spans(l)).toEqual([6, 6]);
    expect(l.rows[0]!.height).toBe(320);
  });

  it('splits twelfths as evenly as it can', () => {
    expect(evenSpans(1)).toEqual([12]);
    expect(evenSpans(3)).toEqual([4, 4, 4]);
    expect(evenSpans(5)).toEqual([3, 3, 3, 3]);
  });

  it('adds a slot by splitting the widest, up to four', () => {
    const id = ids();
    let l = newDashboard(id);
    const row = l.rows[0]!.id;
    l = addDashboardSlot(l, row, id);
    expect(spans(l)).toEqual([3, 3, 6]);
    l = addDashboardSlot(l, row, id);
    expect(spans(l)).toEqual([3, 3, 3, 3]);
    expect(addDashboardSlot(l, row, id)).toBe(l);
  });

  it('gives a removed slot its span to its neighbour, and the last slot takes its row', () => {
    const id = ids();
    let l = newDashboard(id);
    const row = l.rows[0]!;
    l = removeDashboardSlot(l, row.id, row.slots[0]!.id);
    expect(spans(l)).toEqual([12]);
    l = removeDashboardSlot(l, row.id, l.rows[0]!.slots[0]!.id);
    expect(l.rows).toHaveLength(1);
  });

  it('moves a divider in twelfths, never below the narrowest slot', () => {
    let l = newDashboard(ids());
    const row = l.rows[0]!.id;
    l = moveDashboardDivider(l, row, 0, 2);
    expect(spans(l)).toEqual([8, 4]);
    l = moveDashboardDivider(l, row, 0, 99);
    expect(spans(l)).toEqual([10, 2]);
    expect(moveDashboardDivider(l, row, 0, 1)).toBe(l);
  });

  it('adds rows up to twelve, after the one asked for', () => {
    const id = ids();
    let l = newDashboard(id);
    l = addDashboardRow(l, id, l.rows[0]!.id);
    expect(l.rows[1]!.id).not.toBe(newDashboard(ids()).rows[1]!.id);
    while (l.rows.length < DASHBOARD_ROWS_MAX) l = addDashboardRow(l, id);
    expect(addDashboardRow(l, id)).toBe(l);
  });

  it('clamps a row height', () => {
    const l = newDashboard(ids());
    const row = l.rows[0]!.id;
    expect(setDashboardRowHeight(l, row, 5).rows[0]!.height).toBe(DASHBOARD_ROW_H_MIN);
    expect(setDashboardRowHeight(l, row, 1e6).rows[0]!.height).toBe(DASHBOARD_ROW_H_MAX);
  });

  it('sets and clears a slot content', () => {
    const l = newDashboard(ids());
    const slot = l.rows[1]!.slots[1]!.id;
    const set = setDashboardContent(l, slot, { type: 'element', elementId: 'v1' });
    expect(dashboardElementIds(set)).toEqual(new Set(['v1']));
    expect(setDashboardContent(set, slot, undefined).rows[1]!.slots[1]!.content).toBeUndefined();
  });

  it('reads a stored or forged layout within its limits', () => {
    expect(readDashboard(null)).toBeNull();
    expect(readDashboard({ rows: 'x' })).toBeNull();
    const read = readDashboard({
      rows: [
        {
          id: 'r',
          height: -4,
          slots: [
            { id: 'a', span: 1, content: { type: 'tab', tabId: 't' } },
            { id: 'b', span: 40, content: { type: 'evil' } },
            { id: 'c', span: 6 },
            { id: 'd', span: 6 },
            { id: 'e', span: 6 },
          ],
        },
        { id: 'empty', slots: [] },
      ],
    })!;
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0]!.height).toBe(DASHBOARD_ROW_H_MIN);
    expect(read.rows[0]!.slots).toHaveLength(4);
    expect(spans(read).reduce((a, b) => a + b, 0)).toBe(12);
    expect(spans(read).every((s) => s >= 2)).toBe(true);
    expect(read.rows[0]!.slots[0]!.content).toEqual({ type: 'tab', tabId: 't' });
    expect(read.rows[0]!.slots[1]!.content).toBeUndefined();
  });
});

// docs/specs/026-plan/plan-tabs.md "The kinds".
describe('the Plan tab kinds', () => {
  it.each(['board', 'sheet', 'dashboard'] as const)('a %s tab is always in Plan', (kind) => {
    const tab = { id: 't', kind, opensIn: 'draw' as const };
    expect(tabKindOf(tab)).toBe(kind);
    expect(opensInOf(tab)).toBe('plan');
    expect(editorModeSwitchable(tab)).toBe(false);
    expect(setTabOpensIn(tab, 'diagram')).toBe(tab);
  });
});

describe('dashboard presets', () => {
  it('each makes a layout within the limits, empty', async () => {
    const { DASHBOARD_PRESETS, dashboardFromPreset } = await import('./dashboard');
    for (const p of DASHBOARD_PRESETS) {
      const l = dashboardFromPreset(p.id, ids());
      expect(l.rows).toHaveLength(p.rows.length);
      for (const [i, row] of l.rows.entries()) {
        expect(row.slots.map((s) => s.span)).toEqual([...p.rows[i]![1]]);
        expect(row.slots.every((s) => !s.content)).toBe(true);
      }
    }
    expect(dashboardFromPreset('nope', ids()).rows).toHaveLength(2);
  });
});

describe('dashboard drop zones', () => {
  it('puts a slot at either end or between two, taking half the wider neighbour', async () => {
    const { insertDashboardSlot, insertDashboardRow, newDashboard } = await import('./dashboard');
    const id = ids();
    const l = newDashboard(id);
    const row = l.rows[0]!.id;
    const spansOf = (x: typeof l) => x.rows[0]!.slots.map((s) => s.span);
    expect(spansOf(insertDashboardSlot(l, row, 0, id))).toEqual([3, 3, 6]);
    expect(spansOf(insertDashboardSlot(l, row, 2, id))).toEqual([6, 3, 3]);
    expect(spansOf(insertDashboardSlot(l, row, 1, id))).toEqual([3, 3, 6]);
    const rows = insertDashboardRow(l, 1, 160, 4, id);
    expect(rows.rows.map((r) => r.slots.length)).toEqual([2, 4, 2]);
    expect(rows.rows[1]!.height).toBe(160);
    expect(insertDashboardRow(l, 0, 320, 1, id).rows[0]!.slots[0]!.span).toBe(12);
  });
});

describe('moving a slot', () => {
  it('swaps what two slots hold, leaving their spans', async () => {
    const { moveDashboardSlot, newDashboard, setDashboardContent } = await import('./dashboard');
    const id = ids();
    let l = newDashboard(id);
    const [a, b] = l.rows[0]!.slots;
    l = setDashboardContent(l, a!.id, { type: 'note', title: 'A', text: '' });
    const moved = moveDashboardSlot(l, a!.id, { kind: 'slot', slotId: b!.id }, id);
    expect(moved.rows[0]!.slots[0]!.content).toBeUndefined();
    expect(moved.rows[0]!.slots[1]!.content).toMatchObject({ title: 'A' });
  });

  it('moves within its row, and into another row taking half the wider neighbour', async () => {
    const { moveDashboardSlot, newDashboard } = await import('./dashboard');
    const id = ids();
    const l = newDashboard(id);
    const [r0, r1] = l.rows;
    const a = r0!.slots[0]!.id;
    const within = moveDashboardSlot(l, a, { kind: 'slot-gap', rowId: r0!.id, index: 2 }, id);
    expect(within.rows[0]!.slots.map((s) => s.id)).toEqual([r0!.slots[1]!.id, a]);
    const across = moveDashboardSlot(l, a, { kind: 'slot-gap', rowId: r1!.id, index: 0 }, id);
    expect(across.rows[0]!.slots.map((s) => s.span)).toEqual([12]);
    expect(across.rows[1]!.slots.map((s) => [s.id === a, s.span])).toEqual([
      [true, 3],
      [false, 3],
      [false, 6],
    ]);
  });

  it('makes a row of its own between rows, the old row going with its last slot', async () => {
    const { moveDashboardSlot, newDashboard, removeDashboardSlot } = await import('./dashboard');
    const id = ids();
    let l = newDashboard(id);
    l = removeDashboardSlot(l, l.rows[0]!.id, l.rows[0]!.slots[1]!.id);
    const only = l.rows[0]!.slots[0]!.id;
    expect(moveDashboardSlot(l, only, { kind: 'row-gap', index: 0 }, id)).toBe(l);
    const out = moveDashboardSlot(l, only, { kind: 'row-gap', index: 2 }, id);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[1]!.slots.map((s) => [s.id, s.span])).toEqual([[only, 12]]);
  });

  it('makes no new row at the row limit, so the moved slot never falls off the dashboard', async () => {
    const { moveDashboardSlot, newDashboard } = await import('./dashboard');
    const id = ids();
    let l = newDashboard(id);
    while (l.rows.length < DASHBOARD_ROWS_MAX) l = addDashboardRow(l, id);
    const moving = l.rows[0]!.slots[0]!.id;
    l = setDashboardContent(l, moving, { type: 'element', elementId: 'board' });
    const out = moveDashboardSlot(l, moving, { kind: 'row-gap', index: 12 }, id);
    expect(out).toBe(l);
    const kept = readDashboard(out)!.rows.flatMap((r) => r.slots.map((s) => s.id));
    expect(kept).toContain(moving);
  });
});

describe('a slot’s neighbour', () => {
  it('is beside it in its row, and nearest its middle in the row above or below', async () => {
    const { dashboardNeighbour, newDashboard } = await import('./dashboard');
    const l = newDashboard(ids());
    const [a, b] = l.rows[0]!.slots;
    const below = l.rows[1]!.slots;
    expect(dashboardNeighbour(l, a!.id, 'right')).toBe(b!.id);
    expect(dashboardNeighbour(l, a!.id, 'left')).toBeNull();
    expect(dashboardNeighbour(l, a!.id, 'up')).toBeNull();
    expect(dashboardNeighbour(l, b!.id, 'down')).toBe(below.at(-1)!.id);
    expect(dashboardNeighbour(l, below[0]!.id, 'up')).toBe(a!.id);
  });
});

describe('a Title slot', () => {
  it('reads back its heading and description, capped as a note’s are', () => {
    const layout = readDashboard({
      rows: [
        {
          id: 'r',
          height: 160,
          slots: [
            { id: 's', span: 12, content: { type: 'title', title: 'x'.repeat(500), text: 'Why' } },
          ],
        },
      ],
    });
    const c = layout!.rows[0]!.slots[0]!.content!;
    expect(c.type).toBe('title');
    expect(c.type === 'title' && c.title.length).toBe(DASHBOARD_NOTE_TITLE_MAX);
    expect(c.type === 'title' && c.text).toBe('Why');
  });
});

describe('a row that fills the page', () => {
  it('keeps its fill flag, and drops anything else', () => {
    const read = (fill: unknown) =>
      readDashboard({ rows: [{ id: 'r', height: 300, fill, slots: [{ id: 's', span: 12 }] }] })!
        .rows[0]!;
    expect(read(true).fill).toBe(true);
    expect('fill' in read('yes')).toBe(false);
  });
});

describe('remapping a dashboard to new element ids', () => {
  const layout: DashboardLayout = {
    rows: [
      {
        id: 'r1',
        height: 320,
        slots: [
          { id: 's1', span: 6, content: { type: 'element', elementId: 'old-view' } },
          { id: 's2', span: 6, content: { type: 'note', title: 'N', text: '' } },
        ],
      },
      { id: 'r2', height: 320, slots: [{ id: 's3', span: 12 }] },
    ],
  };

  it('points each element slot at its element’s new id', () => {
    const next = remapDashboardElements(layout, new Map([['old-view', 'new-view']]));
    expect(next.rows[0]!.slots[0]!.content).toEqual({ type: 'element', elementId: 'new-view' });
    expect(next.rows[0]!.slots[1]).toBe(layout.rows[0]!.slots[1]);
    expect(next.rows[1]).toBe(layout.rows[1]);
  });

  it('is the same layout when no slot’s element moved', () => {
    expect(remapDashboardElements(layout, new Map([['other', 'x']]))).toBe(layout);
  });

  it('points a figure from a Sheet at the Sheet copied with it, and leaves one from another Sheet', () => {
    const copied = 'a1b2c3d4e5f60718';
    const other = 'ffffffffffffffff';
    const figures: DashboardLayout = {
      rows: [
        {
          id: 'r1',
          height: 320,
          slots: [
            {
              id: 's1',
              span: 6,
              content: {
                type: 'sheet-metric',
                metric: 'figure',
                sheetId: copied,
                cell: { r: 'abcd', c: 'efgh' },
              },
            },
            {
              id: 's2',
              span: 6,
              content: {
                type: 'sheet-metric',
                metric: 'summary',
                sheetId: other,
                col: 'abcd',
                stat: 'sum',
              },
            },
          ],
        },
      ],
    };
    const next = remapDashboardElements(
      figures,
      new Map(),
      new Map([[copied, '0123456789abcdef']]),
    );
    expect(next.rows[0]!.slots[0]!.content).toEqual({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: '0123456789abcdef',
      cell: { r: 'abcd', c: 'efgh' },
    });
    expect(next.rows[0]!.slots[1]).toBe(figures.rows[0]!.slots[1]);
  });
});

// docs/specs/026-plan/plan-tabs.md "Import and Export of a Dashboard": a layout's ids are its own.
describe('a Dashboard layout’s ids', () => {
  it('reads a repeated row or slot id as a fresh one, the same every time', () => {
    const stored = {
      rows: [
        {
          id: 'r',
          height: 300,
          slots: [
            { id: 'a', span: 6 },
            { id: 'a', span: 6 },
          ],
        },
        { id: 'r', height: 300, slots: [{ id: 'a', span: 12 }] },
      ],
    };
    const read = readDashboard(stored)!;
    const rowIds = read.rows.map((r) => r.id);
    const slotIds = read.rows.flatMap((r) => r.slots.map((s) => s.id));
    expect(new Set(rowIds).size).toBe(2);
    expect(new Set(slotIds).size).toBe(3);
    expect(rowIds[0]).toBe('r');
    expect(slotIds[0]).toBe('a');
    expect(readDashboard(stored)).toEqual(read);
  });

  it('re-mints every row and slot id, keeping the rest', () => {
    const layout: DashboardLayout = {
      rows: [
        {
          id: 'r1',
          height: 320,
          slots: [
            { id: 's1', span: 6, content: { type: 'element', elementId: 'v' } },
            { id: 's2', span: 6 },
          ],
        },
        { id: 'r2', height: 320, slots: [{ id: 's3', span: 12 }] },
      ],
    };
    let n = 0;
    const next = remintDashboardIds(layout, () => `new${n++}`);
    expect(next.rows.map((r) => r.id)).toEqual(['new0', 'new3']);
    expect(next.rows[0]!.slots.map((s) => s.id)).toEqual(['new1', 'new2']);
    expect(next.rows[0]!.slots[0]!.content).toEqual(layout.rows[0]!.slots[0]!.content);
  });
});

// docs/specs/026-plan/plan-tabs.md "Dashboard Settings".
describe('a Dashboard’s settings', () => {
  const ids = () => {
    let n = 0;
    return () => `id${n++}`;
  };
  it('keeps a tinted background through a read and every layout change, and drops anything else', async () => {
    const d = await import('./dashboard');
    const id = ids();
    const plain = d.dashboardFromPreset('two-by-two', id);
    const tinted = d.setDashboardBackground(plain, 'tint');
    expect(tinted.background).toBe('tint');
    expect(d.readDashboard({ ...plain, background: 'tint' })?.background).toBe('tint');
    expect(d.readDashboard({ ...plain, background: 'neon' })?.background).toBeUndefined();
    expect(d.addDashboardRow(tinted, id).background).toBe('tint');
    expect(d.insertDashboardRow(tinted, 0, 200, 2, id).background).toBe('tint');
    const slot = tinted.rows[0]!.slots[0]!.id;
    const filled = d.setDashboardContent(tinted, slot, { type: 'note', title: 'N', text: '' });
    expect(filled.background).toBe('tint');
    expect(d.moveDashboardSlot(filled, slot, { kind: 'row-gap', index: 2 }, id).background).toBe(
      'tint',
    );
    expect(d.setDashboardBackground(tinted, 'tint')).toBe(tinted);
    expect(d.setDashboardBackground(tinted, 'plain')).toEqual(plain);
  });

  it('clears every slot, keeping its rows and spans', async () => {
    const d = await import('./dashboard');
    const plain = d.dashboardFromPreset('overview', ids());
    expect(d.clearDashboard(plain)).toBe(plain);
    const slot = plain.rows[1]!.slots[0]!.id;
    const filled = d.setDashboardContent(plain, slot, { type: 'element', elementId: 'e' });
    const cleared = d.clearDashboard(filled);
    expect(cleared.rows.flatMap((r) => r.slots).some((s) => s.content)).toBe(false);
    expect(cleared.rows.map((r) => r.slots.map((s) => s.span))).toEqual([
      [3, 3, 3, 3],
      [6, 6],
    ]);
  });

  it('starts over from a layout, keeping the background', async () => {
    const d = await import('./dashboard');
    const id = ids();
    const tinted = d.setDashboardBackground(d.dashboardFromPreset('two-by-two', id), 'tint');
    const next = d.relayoutDashboard(tinted, 'focus', id);
    expect(next.rows.map((r) => r.slots.map((s) => s.span))).toEqual([[8, 4]]);
    expect(next.background).toBe('tint');
  });
});
