import { describe, expect, it } from 'vitest';
import {
  insertDashboardSlot,
  moveDashboardSlot,
  type DashboardContent,
  type DashboardLayout,
} from '@livepages/document';
import { keepsFit, rowHeightFloor, slotWidthFloor, spanPx, type FitOf } from './slot-fit';
import { dashboardCandidates, dashboardZone, type DashboardGeometry } from './dashboard-drop';

// docs/specs/026-plan/plan-tabs.md "Filling a slot": a change to the layout never squeezes content below what it needs.
const board: DashboardContent = { type: 'tab', tabId: 'b', of: 'board' };
const metric: DashboardContent = { type: 'note', title: 'm', text: '' };
const fitOf: FitOf = (c) => (!c ? null : c.type === 'tab' ? (c.of ?? 'board') : 'note');
const id = () => 'new';
const W = 1000;

const layout: DashboardLayout = {
  rows: [
    {
      id: 'r1',
      height: 480,
      slots: [
        { id: 'a', span: 6, content: board },
        { id: 'e', span: 6 },
      ],
    },
    { id: 'r2', height: 160, slots: [{ id: 'm', span: 12, content: metric }] },
  ],
};

describe('keeping content looking good as the layout changes', () => {
  it('measures a slot as its twelfths less its share of the gaps', () => {
    expect(spanPx(12, W)).toBe(W);
    expect(spanPx(6, W)).toBe(494);
  });

  it('refuses a slot that would squeeze a board below its width', () => {
    const after = insertDashboardSlot(layout, 'r1', 0, id);
    expect(after).not.toBe(layout);
    expect(keepsFit(layout, after, fitOf, W)).toBe(false);
  });

  it('allows a slot beside content that has room', () => {
    expect(keepsFit(layout, insertDashboardSlot(layout, 'r2', 1, id), fitOf, W)).toBe(true);
  });

  it('refuses moving a board into a short row, or swapping it there', () => {
    const swap = moveDashboardSlot(layout, 'a', { kind: 'slot', slotId: 'm' }, id);
    expect(keepsFit(layout, swap, fitOf, W)).toBe(false);
    const into = moveDashboardSlot(layout, 'a', { kind: 'slot-gap', rowId: 'r2', index: 1 }, id);
    expect(keepsFit(layout, into, fitOf, W)).toBe(false);
  });

  it('lets an older, already squeezed layout change in other ways', () => {
    const tight: DashboardLayout = {
      rows: [
        { id: 'r', height: 160, slots: [{ id: 'a', span: 12, content: board }] },
        ...layout.rows.slice(1),
      ],
    };
    expect(keepsFit(tight, insertDashboardSlot(tight, 'r2', 1, id), fitOf, W)).toBe(true);
  });

  it('does not check a condensed page, or one not yet measured', () => {
    const after = insertDashboardSlot(layout, 'r1', 0, id);
    expect(keepsFit(layout, after, fitOf, 500)).toBe(true);
    expect(keepsFit(layout, after, fitOf, null)).toBe(true);
  });

  it('floors a row’s height and a slot’s width at what their content needs', () => {
    expect(rowHeightFloor(layout.rows[0]!, fitOf)).toBe(440);
    expect(rowHeightFloor(layout.rows[1]!, fitOf)).toBe(0);
    expect(slotWidthFloor(layout.rows[0]!.slots[0]!, fitOf)).toBe(480);
  });
});

describe('zones a check turns away', () => {
  const box = (left: number, right: number, top: number, bottom: number) => ({
    left,
    right,
    top,
    bottom,
  });
  const geo: DashboardGeometry = {
    rows: [
      {
        id: 'r1',
        box: box(0, 1000, 0, 320),
        slots: [
          { id: 'a', box: box(0, 494, 0, 320) },
          { id: 'e', box: box(506, 1000, 0, 320) },
        ],
      },
    ],
  };
  const deny = () => false;

  it('a slot tile over a row lands nowhere when the check refuses its gap', () => {
    expect(dashboardZone({ kind: 'slot' }, geo, 10, 100)).toMatchObject({ kind: 'slot-gap' });
    expect(dashboardZone({ kind: 'slot' }, geo, 10, 100, deny)).toBeNull();
  });

  it('a pressed slot tile is offered only the gaps the check allows', () => {
    const all = dashboardCandidates({ kind: 'slot' }, geo, 4);
    const some = dashboardCandidates({ kind: 'slot' }, geo, 4, (z) => z.kind !== 'slot-gap');
    expect(some.length).toBeLessThan(all.length);
    expect(some.every((z) => z.kind === 'row-gap')).toBe(true);
  });
});
