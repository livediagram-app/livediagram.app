import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  addDashboardRow,
  insertDashboardSlot,
  moveDashboardDivider,
  moveDashboardSlot,
  readDashboard,
  relayoutDashboard,
  removeDashboardSlot,
  setDashboardBackground,
  setDashboardContent,
  setDashboardRowHeight,
  type DashboardLayout,
} from './dashboard';
import {
  applyDashboardPatch,
  dashboardPatch,
  dashboardPatchFields,
  isDashboardPatch,
  withoutDashboardFields,
  type DashboardPatch,
} from './dashboard-patch';

// docs/specs/012-collaboration/collab-race-hardening.md "A Dashboard's layout travels as deltas".

let n = 0;
const newId = () => `n${++n}`;

// Two rows of two slots, the second row's slots holding a note and a tab.
const layout = (): DashboardLayout => ({
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
        { id: 's3', span: 6, content: { type: 'note', title: 'Note', text: 'hello' } },
        { id: 's4', span: 6, content: { type: 'tab', tabId: 'b1', of: 'board' } },
      ],
    },
  ],
});

// A change made on one side, sent as a patch and applied on the other.
const sent = (before: DashboardLayout, after: DashboardLayout) => {
  const patch = dashboardPatch(before, after);
  expect(patch).not.toBeNull();
  return patch!;
};

// Both orders of two concurrent patches over one base, as two screens apply them.
const bothOrders = (base: DashboardLayout, a: DashboardPatch, b: DashboardPatch) => [
  applyDashboardPatch(applyDashboardPatch(base, a), b),
  applyDashboardPatch(applyDashboardPatch(base, b), a),
];

describe('dashboardPatch', () => {
  it('names nothing for the same layout, or when either side has none', () => {
    const base = layout();
    expect(dashboardPatch(base, base)).toBeNull();
    expect(dashboardPatch(base, structuredClone(base))).toBeNull();
    expect(dashboardPatch(undefined, base)).toBeNull();
    expect(dashboardPatch(base, undefined)).toBeNull();
  });

  it('names a row height by row id, and nothing else', () => {
    const base = layout();
    expect(sent(base, setDashboardRowHeight(base, 'r2', 340))).toEqual({
      rows: { r2: { set: { height: 340 } } },
    });
  });

  it('names a divider move as the two spans it changed', () => {
    const base = layout();
    expect(sent(base, moveDashboardDivider(base, 'r1', 0, -1))).toEqual({
      slots: { s1: { set: { span: 5 } }, s2: { set: { span: 7 } } },
    });
  });

  it('names a fill and a clear whole, and a setting of what a slot shows field by field', () => {
    const base = layout();
    const filled = setDashboardContent(base, 's1', { type: 'note', title: 'A', text: '' });
    expect(sent(base, filled)).toEqual({
      slots: { s1: { set: { content: { type: 'note', title: 'A', text: '' } } } },
    });
    expect(sent(base, setDashboardContent(base, 's3', undefined))).toEqual({
      slots: { s3: { clear: ['content'] } },
    });
    const retitled = setDashboardContent(base, 's3', {
      type: 'note',
      title: 'Plan',
      text: 'hello',
    });
    expect(sent(base, retitled)).toEqual({ slots: { s3: { set: { 'content.title': 'Plan' } } } });
    const other = setDashboardContent(base, 's3', { type: 'title', title: 'Plan', text: 'hello' });
    expect(sent(base, other).slots!['s3']!.set!['content']).toEqual({
      type: 'title',
      title: 'Plan',
      text: 'hello',
    });
    const unnamed = setDashboardContent(base, 's4', { type: 'tab', tabId: 'b1' });
    expect(sent(base, unnamed)).toEqual({ slots: { s4: { clear: ['content.of'] } } });
  });

  it('names a slot added to a row with the row it joins and the row’s new list', () => {
    const base = layout();
    const after = insertDashboardSlot(base, 'r1', 2, () => 'new');
    const patch = sent(base, after);
    expect(patch.addSlots).toEqual([{ row: 'r1', slot: { id: 'new', span: 3 } }]);
    expect(patch.rowSlots).toEqual({ r1: ['s1', 's2', 'new'] });
    expect(patch.slots).toEqual({ s2: { set: { span: 3 } } });
  });

  it('names a removed slot, a removed row and the background', () => {
    const base = layout();
    const after = setDashboardBackground(
      removeDashboardSlot(removeDashboardSlot(base, 'r1', 's1'), 'r1', 's2'),
      'tint',
    );
    expect(sent(base, after)).toEqual({
      set: { background: 'tint' },
      removeRows: ['r1'],
      removeSlots: ['s1', 's2'],
    });
    expect(sent(after, base).clear).toEqual(['background']);
  });

  it('names a new row whole, with the order, and a moved row by the order alone', () => {
    const base = layout();
    const added = addDashboardRow(base, () => `x${++n}`);
    const patch = sent(base, added);
    expect(patch.addRows).toHaveLength(1);
    expect(patch.order).toEqual(added.rows.map((r) => r.id));
    const swapped = { ...base, rows: [base.rows[1]!, base.rows[0]!] };
    expect(sent(base, swapped)).toEqual({ order: ['r2', 'r1'] });
  });

  it('names a slot moved to another row by both rows’ lists, keeping its own changes', () => {
    const base = layout();
    const moved = moveDashboardSlot(base, 's3', { kind: 'slot-gap', rowId: 'r1', index: 1 }, newId);
    const patch = sent(base, moved);
    expect(patch.rowSlots).toEqual({ r1: ['s1', 's3', 's2'], r2: ['s4'] });
    expect(patch.removeSlots).toBeUndefined();
  });
});

describe('applyDashboardPatch', () => {
  it('lands where the sender is for every kind of change', () => {
    const base = layout();
    const changes = [
      setDashboardRowHeight(base, 'r1', 500),
      moveDashboardDivider(base, 'r2', 0, 2),
      setDashboardContent(base, 's1', { type: 'note', title: 'N', text: 'x' }),
      setDashboardContent(base, 's3', undefined),
      setDashboardContent(base, 's3', { type: 'note', title: 'T', text: 'hello' }),
      insertDashboardSlot(base, 'r2', 0, newId),
      removeDashboardSlot(base, 'r2', 's3'),
      removeDashboardSlot(removeDashboardSlot(base, 'r1', 's1'), 'r1', 's2'),
      addDashboardRow(base, newId, 'r1'),
      moveDashboardSlot(base, 's3', { kind: 'slot-gap', rowId: 'r1', index: 0 }, newId),
      moveDashboardSlot(base, 's1', { kind: 'row-gap', index: 2 }, newId),
      moveDashboardSlot(base, 's3', { kind: 'slot', slotId: 's1' }, newId),
      moveDashboardSlot(base, 's2', { kind: 'slot-gap', rowId: 'r1', index: 0 }, newId),
      setDashboardBackground(base, 'tint'),
      relayoutDashboard(base, 'report', newId),
      { ...base, rows: [{ ...base.rows[0]!, fill: true as const }, base.rows[1]!] },
    ];
    for (const after of changes)
      expect(applyDashboardPatch(base, sent(base, after))).toEqual(after);
  });

  it('keeps the layout itself for a malformed patch or one that changes nothing', () => {
    const base = layout();
    expect(applyDashboardPatch(base, null)).toBe(base);
    expect(applyDashboardPatch(base, { rows: { r1: { set: { colour: 1 } } } })).toBe(base);
    expect(applyDashboardPatch(base, { rows: { r1: { set: { height: 320 } } } })).toBe(base);
    expect(applyDashboardPatch(base, { slots: { gone: { set: { span: 4 } } } })).toBe(base);
    expect(applyDashboardPatch(base, { removeRows: ['gone'], order: ['r1', 'r2'] })).toBe(base);
    expect(applyDashboardPatch(base, { slots: { s1: { set: { 'content.title': 'x' } } } })).toBe(
      base,
    );
    expect(applyDashboardPatch(base, { clear: ['background'] })).toBe(base);
  });

  it('reads a stored layout that is not rows of slots before applying, and leaves one that is no layout', () => {
    const forged = { rows: [{ id: 'r1', height: 320, slots: [{ id: 's1', span: 12 }, 7] }] };
    const out = applyDashboardPatch(forged as unknown as DashboardLayout, {
      rows: { r1: { set: { height: 400 } } },
    });
    expect(out.rows[0]).toEqual({ id: 'r1', height: 400, slots: [{ id: 's1', span: 12 }] });
    const junk = { nope: true } as unknown as DashboardLayout;
    expect(applyDashboardPatch(junk, { set: { background: 'tint' } })).toBe(junk);
  });

  it('is idempotent: a patch applied twice lands where it did once', () => {
    const base = layout();
    for (const after of [
      addDashboardRow(base, newId),
      insertDashboardSlot(base, 'r1', 1, newId),
      moveDashboardSlot(base, 's4', { kind: 'row-gap', index: 0 }, newId),
    ]) {
      const patch = sent(base, after);
      const once = applyDashboardPatch(base, patch);
      expect(applyDashboardPatch(once, patch)).toEqual(once);
    }
  });

  it('covers the edges of placement: an order naming some rows, a slot two places claim, a span alone', () => {
    const base = layout();
    expect(applyDashboardPatch(base, { order: ['r2'] }).rows.map((r) => r.id)).toEqual([
      'r1',
      'r2',
    ]);
    const claimed = applyDashboardPatch(base, {
      rowSlots: { r1: ['s1', 's2'] },
      addRows: [
        {
          id: 'r9',
          height: 200,
          slots: [
            { id: 's1', span: 12 },
            { id: 'z', span: 12 },
          ],
        },
      ],
    });
    expect(claimed.rows.map((r) => r.slots.map((x) => x.id))).toEqual([
      ['s1', 's2'],
      ['s3', 's4'],
      ['z'],
    ]);
    const resized = applyDashboardPatch(base, {
      slots: { s3: { set: { span: 4, 'content.title': 'Note' } } },
    });
    expect(resized.rows[1]!.slots[0]!.content).toBe(base.rows[1]!.slots[0]!.content);
  });

  it('applies a content field only while the slot shows something', () => {
    const base = layout();
    const cleared = setDashboardContent(base, 's3', undefined);
    expect(applyDashboardPatch(cleared, { slots: { s3: { set: { 'content.title': 'x' } } } })).toBe(
      cleared,
    );
    const out = applyDashboardPatch(base, { slots: { s3: { clear: ['content.text'] } } });
    expect(out.rows[1]!.slots[0]!.content).toEqual({ type: 'note', title: 'Note' });
  });
});

describe('two people at once', () => {
  it('a row resize and a divider move both survive, whatever order they land in', () => {
    const base = layout();
    const owner = sent(base, setDashboardRowHeight(base, 'r2', 340));
    const visitor = sent(base, moveDashboardDivider(base, 'r1', 0, -1));
    const [one, two] = bothOrders(base, owner, visitor);
    expect(one).toEqual(two);
    expect(one!.rows[1]!.height).toBe(340);
    expect(one!.rows[0]!.slots.map((s) => s.span)).toEqual([5, 7]);
  });

  it('changes to different slots, rows and settings commute', () => {
    const base = layout();
    const patches = [
      sent(base, setDashboardContent(base, 's1', { type: 'note', title: 'A', text: '' })),
      sent(base, setDashboardContent(base, 's3', { type: 'note', title: 'B', text: 'hello' })),
      sent(base, setDashboardContent(base, 's3', { type: 'note', title: 'Note', text: 'world' })),
      sent(base, setDashboardRowHeight(base, 'r1', 200)),
      sent(base, setDashboardBackground(base, 'tint')),
      sent(base, addDashboardRow(base, newId)),
    ];
    for (const a of patches)
      for (const b of patches) {
        if (a === b) continue;
        const [one, two] = bothOrders(base, a, b);
        expect(one).toEqual(two);
      }
    const all = patches.reduce(applyDashboardPatch, base);
    expect(all.rows[1]!.slots[0]!.content).toEqual({ type: 'note', title: 'B', text: 'world' });
  });

  it('the same field takes whichever patch is applied last', () => {
    const base = layout();
    const a = sent(base, setDashboardRowHeight(base, 'r1', 400));
    const b = sent(base, setDashboardRowHeight(base, 'r1', 200));
    expect(applyDashboardPatch(applyDashboardPatch(base, a), b).rows[0]!.height).toBe(200);
    expect(applyDashboardPatch(applyDashboardPatch(base, b), a).rows[0]!.height).toBe(400);
  });

  it('a removal wins over a change to what it removed, in either order', () => {
    const base = layout();
    const removeRow = sent(
      base,
      removeDashboardSlot(removeDashboardSlot(base, 'r2', 's3'), 'r2', 's4'),
    );
    const resize = sent(base, setDashboardRowHeight(base, 'r2', 600));
    const fill = sent(
      base,
      setDashboardContent(base, 's3', { type: 'note', title: 'x', text: '' }),
    );
    const addThere = sent(base, insertDashboardSlot(base, 'r2', 2, newId));
    const moveThere = sent(
      base,
      moveDashboardSlot(base, 's1', { kind: 'slot-gap', rowId: 'r2', index: 0 }, newId),
    );
    for (const other of [resize, fill, addThere, moveThere]) {
      const [one, two] = bothOrders(base, removeRow, other);
      expect(one).toEqual(two);
      expect(one!.rows.map((r) => r.id)).not.toContain('r2');
    }
  });

  it('a slot added to a row meanwhile stays beside the slot it followed through another’s reorder', () => {
    const base = layout();
    const added = insertDashboardSlot(base, 'r1', 1, () => 'mid');
    const reordered = moveDashboardSlot(
      base,
      's1',
      { kind: 'slot-gap', rowId: 'r1', index: 2 },
      newId,
    );
    const out = applyDashboardPatch(added, sent(base, reordered));
    expect(out.rows[0]!.slots.map((s) => s.id)).toEqual(['s2', 's1', 'mid']);
  });

  it('a row added meanwhile keeps its place through another’s row reorder', () => {
    const base = layout();
    const added = addDashboardRow(base, () => 'r3', 'r1');
    const swapped = sent(base, { ...base, rows: [base.rows[1]!, base.rows[0]!] });
    expect(applyDashboardPatch(added, swapped).rows.map((r) => r.id)).toEqual(['r2', 'r1', 'r3']);
  });

  it('a slot added to a row nobody lists joins the row’s end, and one for a removed row goes with it', () => {
    const base = layout();
    const joined = applyDashboardPatch(base, {
      addSlots: [
        { row: 'r1', slot: { id: 'j', span: 2 } },
        { row: 'gone', slot: { id: 'k', span: 2 } },
      ],
    });
    expect(joined.rows[0]!.slots.map((s) => s.id)).toEqual(['s1', 's2', 'j']);
    expect(joined.rows.flatMap((r) => r.slots.map((s) => s.id))).not.toContain('k');
  });

  it('never duplicates a slot two lists both name', () => {
    const base = layout();
    const out = applyDashboardPatch(base, {
      rowSlots: { r1: ['s1', 's2', 's3'], r2: ['s3', 's4'] },
    });
    const ids = out.rows.flatMap((r) => r.slots.map((s) => s.id));
    expect(ids.filter((id) => id === 's3')).toHaveLength(1);
  });

  it('spans that no longer add to twelve are fitted on every read alike', () => {
    const base = layout();
    const divider = sent(base, moveDashboardDivider(base, 'r1', 0, -1));
    const split = sent(
      base,
      insertDashboardSlot(base, 'r1', 2, () => 'x'),
    );
    // Room order: the divider, then the split. The divider's sender takes the split whole; the split's sender, still
    // holding the span it wrote, leaves that one field of the divider out (own-element-writes.ts).
    const held = new Set(dashboardPatchFields(split));
    const dividerScreen = applyDashboardPatch(applyDashboardPatch(base, divider), split);
    const splitScreen = applyDashboardPatch(
      applyDashboardPatch(base, split),
      withoutDashboardFields(divider, (k) => held.has(k)),
    );
    expect(splitScreen).toEqual(dividerScreen);
    expect(readDashboard(splitScreen)!.rows[0]!.slots.map((s) => s.span)).toEqual([5, 3, 4]);
  });
});

describe('isDashboardPatch', () => {
  it('refuses frames that are not patches', () => {
    for (const bad of [
      null,
      [],
      { set: { colour: 1 } },
      { clear: 'background' },
      { rows: [] },
      { rows: { r1: { set: { span: 1 } } } },
      { slots: { s1: { clear: ['nope'] } } },
      { slots: { s1: { set: [] } } },
      { rows: { r1: 5 } },
      { slots: { '': { set: { span: 1 } } } },
      { slots: { s1: { set: { 'content.': 1 } } } },
      { addRows: [{ id: 'r', slots: [{ span: 2 }] }] },
      { addRows: {} },
      { addSlots: [{ row: 'r', slot: {} }] },
      { addSlots: 'x' },
      { removeRows: [1] },
      { order: 'r1' },
      { rowSlots: [] },
      { rowSlots: { r1: [''] } },
      { removeSlots: Array.from({ length: 300 }, (_, i) => `s${i}`) },
      { rows: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`r${i}`, {}])) },
    ])
      expect(isDashboardPatch(bad)).toBe(false);
    expect(isDashboardPatch({})).toBe(true);
  });
});

describe('held fields', () => {
  const patch: DashboardPatch = {
    set: { background: 'tint' },
    rows: { r1: { set: { height: 400 }, clear: ['fill'] } },
    slots: { s1: { set: { span: 5, 'content.title': 'x' } }, s2: { clear: ['content'] } },
    order: ['r2', 'r1'],
  };

  it('names every field a patch writes', () => {
    expect(dashboardPatchFields(patch)).toEqual([
      'background',
      'r:r1:height',
      'r:r1:fill',
      's:s1:span',
      's:s1:content.title',
      's:s2:content',
    ]);
  });

  it('leaves out held fields and keeps the structure; null when nothing is left', () => {
    const held = new Set(['background', 'r:r1:height', 's:s1:span', 's:s2:content']);
    expect(withoutDashboardFields(patch, (k) => held.has(k))).toEqual({
      order: ['r2', 'r1'],
      rows: { r1: { clear: ['fill'] } },
      slots: { s1: { set: { 'content.title': 'x' } } },
    });
    expect(withoutDashboardFields({ rows: { r1: { set: { height: 1 } } } }, () => true)).toBeNull();
    expect(withoutDashboardFields(patch, () => false)).toBe(patch);
    expect(dashboardPatchFields({ clear: ['background'] })).toEqual(['background']);
    const heldHeight = (k: string) => k === 'r:r1:height';
    const rows = { r1: { set: { height: 1 } } };
    expect(withoutDashboardFields({ clear: ['background'], rows }, heldHeight)).toEqual({
      clear: ['background'],
    });
    expect(withoutDashboardFields({ set: { background: 'tint' }, rows }, heldHeight)).toEqual({
      set: { background: 'tint' },
    });
  });
});

describe('cost', () => {
  // The largest layout (12 rows of 4 slots, each a long note), every slot changed at once.
  const big = (): DashboardLayout => ({
    rows: Array.from({ length: 12 }, (_, r) => ({
      id: `row-${r}`,
      height: 320,
      slots: Array.from({ length: 4 }, (_, s) => ({
        id: `slot-${r}-${s}`,
        span: 3,
        content: { type: 'note' as const, title: 'T', text: 'x'.repeat(2000) },
      })),
    })),
  });

  it('diffs and applies the largest layout within budget', () => {
    const before = big();
    const after = {
      ...before,
      rows: before.rows.map((r) => ({
        ...r,
        height: 400,
        slots: r.slots.map((s) => ({
          ...s,
          content: { type: 'note' as const, title: 'U', text: 'x'.repeat(2000) },
        })),
      })),
    };
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i += 1) applyDashboardPatch(before, dashboardPatch(before, after));
    });
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
