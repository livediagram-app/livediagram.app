import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '@liveplanner/project';
import { applyDashboardChanges } from './plan-ai-dashboard';

// Plan AI on a Dashboard (docs/specs/026-plan/plan-ai.md "On a dashboard").

const LAYOUT: DashboardLayout = {
  rows: [
    {
      id: 'r1',
      height: 320,
      slots: [
        { id: 's1', span: 6, content: { type: 'note', title: 'Hi', text: 'there' } },
        { id: 's2', span: 6 },
      ],
    },
    { id: 'r2', height: 240, slots: [{ id: 's3', span: 12 }] },
  ],
};
const TABS = [
  { id: 'b', name: 'Roadmap', kind: 'board' },
  { id: 'd', name: 'Overview', kind: 'dashboard' },
];

let n = 0;
const id = () => `n${++n}`;
const run = (changes: Record<string, unknown>[], layout = LAYOUT) =>
  applyDashboardChanges(layout, changes as never, TABS, id);

describe('applyDashboardChanges', () => {
  it('adds and removes rows, by number as the dashboard stood', () => {
    const out = run([
      { op: 'add_row', at: 1, slots: 3, height: 200 },
      { op: 'remove_row', row: 2 },
      { op: 'add_row' },
    ]);
    expect(out.lines.every((l) => l.ok)).toBe(true);
    expect(out.layout.rows.map((r) => r.slots.length)).toEqual([3, 2, 2]);
    expect(out.layout.rows[0]!.height).toBe(200);
    expect(out.layout.rows.map((r) => r.id)).not.toContain('r2');
  });

  it('removed row 2 is the one that was second, even after a row went in above it', () => {
    const out = run([
      { op: 'add_row', at: 1 },
      { op: 'remove_row', row: 2 },
    ]);
    expect(out.layout.rows.map((r) => r.id)).not.toContain('r2');
  });

  it('adds, removes, resizes and moves slots, and sets a row height', () => {
    const out = run([
      { op: 'resize_slot', row: 1, slot: 1, span: 8 },
      { op: 'add_slot', row: 2, at: 1 },
      { op: 'row_height', row: 2, height: 500 },
      { op: 'move_slot', row: 1, slot: 2, toRow: 1, toSlot: 1 },
    ]);
    expect(out.lines.map((l) => l.ok)).toEqual([true, true, true, true]);
    expect(out.layout.rows[0]!.slots.map((s) => [s.id, s.span])).toEqual([
      ['s2', 4],
      ['s1', 8],
    ]);
    expect(out.layout.rows[1]!.slots).toHaveLength(2);
    expect(out.layout.rows[1]!.height).toBe(500);
    expect(run([{ op: 'resize_slot', row: 1, slot: 1, span: 12 }]).lines[0]!.text).toBe(
      'Made slot 1 of row 1 10 twelfths wide',
    );
    const last = run([{ op: 'resize_slot', row: 1, slot: 2, span: 4 }]);
    expect(last.layout.rows[0]!.slots.map((s) => s.span)).toEqual([8, 4]);
    const right = run([{ op: 'move_slot', row: 1, slot: 1, toSlot: 2 }]);
    expect(right.layout.rows[0]!.slots.map((s) => s.id)).toEqual(['s2', 's1']);
    const across = run([{ op: 'move_slot', row: 1, slot: 2, toRow: 2 }]);
    expect(across.layout.rows[1]!.slots.map((s) => s.id)).toContain('s2');
  });

  it('puts a note, a Board tab, or nothing in a slot, and removes one', () => {
    const out = run([
      { op: 'note', row: 1, slot: 2, title: 'Week', text: 'Ship it' },
      { op: 'show_tab', row: 2, slot: 1, tab: 'roadmap' },
      { op: 'clear_slot', row: 1, slot: 1 },
      { op: 'remove_slot', row: 1, slot: 1 },
    ]);
    expect(out.lines.every((l) => l.ok)).toBe(true);
    expect(out.layout.rows[0]!.slots).toEqual([
      { id: 's2', span: 12, content: { type: 'note', title: 'Week', text: 'Ship it' } },
    ]);
    expect(out.layout.rows[1]!.slots[0]!.content).toEqual({ type: 'tab', tabId: 'b', of: 'board' });
    expect(run([{ op: 'note', row: 1, slot: 2 }]).lines[0]!.text).toBe('Put a note in row 1');
  });

  it('stops at the first change it cannot make, keeping the ones before it, and says why', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ op: 'remove_row', row: 9 }, /no row 9/],
      [{ op: 'remove_slot', row: 1, slot: 5 }, /no slot 5/],
      [{ op: 'resize_slot', row: 1, slot: 1 }, /span/],
      [{ op: 'resize_slot', row: 2, slot: 1, span: 6 }, /only slot/],
      [{ op: 'resize_slot', row: 1, slot: 1, span: 6 }, /at least 2/],
      [{ op: 'row_height', row: 1 }, /height/],
      [{ op: 'show_tab', row: 1, slot: 1, tab: 'Nope' }, /Roadmap/],
      [{ op: 'add' }, /can’t take/],
    ];
    for (const [change, why] of cases) {
      const out = run([{ op: 'row_height', row: 1, height: 400 }, change]);
      expect(out.lines[1]).toMatchObject({ ok: false, text: expect.stringMatching(why) });
      expect(out.layout.rows[0]!.height).toBe(400);
    }
    const gone = run([
      { op: 'remove_row', row: 1 },
      { op: 'clear_slot', row: 1, slot: 1 },
    ]);
    expect(gone.lines[1]!.text).toMatch(/removed by an earlier change/);
    const slotGone = run([
      { op: 'remove_slot', row: 1, slot: 1 },
      { op: 'clear_slot', row: 1, slot: 1 },
    ]);
    expect(slotGone.lines[1]!.text).toMatch(/removed by an earlier change/);
    expect(run([{ op: 'show_tab', row: 1, slot: 1, tab: 'x' }], LAYOUT).lines[0]!.ok).toBe(false);
  });

  it('keeps to the limits: twelve rows, four slots a row, a full row takes no moved slot', () => {
    const full: DashboardLayout = {
      rows: Array.from({ length: 12 }, (_, i) => ({
        id: `f${i}`,
        height: 200,
        slots: [
          { id: `a${i}`, span: 3 },
          { id: `b${i}`, span: 3 },
          { id: `c${i}`, span: 3 },
          { id: `d${i}`, span: 3 },
        ],
      })),
    };
    expect(run([{ op: 'add_row' }], full).lines[0]!.text).toMatch(/at most 12 rows/);
    expect(run([{ op: 'add_slot', row: 1 }], full).lines[0]!.text).toMatch(/no room/);
    expect(run([{ op: 'move_slot', row: 1, slot: 1, toRow: 2 }], full).lines[0]!.text).toMatch(
      /row is full/,
    );
  });
});
