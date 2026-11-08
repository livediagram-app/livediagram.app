// The Dashboards track's missions (docs/specs/026-plan/plan-tour.md "Dashboards: Layout View"): fixed from the
// dashboard as the tour starts, each done by the person's own change to it.

import { describe, expect, it } from 'vitest';
import {
  dashboardFromPreset,
  setDashboardContent,
  type DashboardLayout,
} from '@liveplanner/project';
import { emptyCount, layoutMissions } from './layout-missions';

let n = 0;
const id = () => `id${n++}`;
const note = { type: 'note', title: 'N', text: '' } as const;
const ids = (l: DashboardLayout, condensed = false) =>
  layoutMissions(l, condensed).map((m) => m.id);
const ctx = (start: DashboardLayout, now: DashboardLayout) => ({ start, now });
const fillAll = (l: DashboardLayout) =>
  l.rows.flatMap((r) => r.slots).reduce((acc, s) => setDashboardContent(acc, s.id, note), l);
const oneSlot = (l: DashboardLayout): DashboardLayout => ({
  ...l,
  rows: l.rows.map((r) => ({ ...r, slots: r.slots.slice(0, 1).map((s) => ({ ...s, span: 12 })) })),
});

describe('layoutMissions', () => {
  it('resizes, changes a row and fills a slot on a dashboard of pairs', () => {
    expect(ids(dashboardFromPreset('two-by-two', id))).toEqual([
      'resize-slots',
      'row-height',
      'fill-slot',
    ]);
  });

  it('adds a slot where no row has two, and skips filling when nothing is empty', () => {
    const l = fillAll(oneSlot(dashboardFromPreset('two-by-two', id)));
    expect(emptyCount(l)).toBe(0);
    expect(ids(l)).toEqual(['add-slot', 'row-height']);
  });

  it('skips the row height when every row fills the page', () => {
    const base = dashboardFromPreset('two-by-two', id);
    const filling: DashboardLayout = {
      ...base,
      rows: base.rows.map((r) => ({ ...r, fill: true as const })),
    };
    expect(ids(filling)).toEqual(['resize-slots', 'fill-slot']);
  });

  it('on a phone asks only to fill a slot, or nothing', () => {
    const base = dashboardFromPreset('two-by-two', id);
    expect(ids(base, true)).toEqual(['fill-slot']);
    expect(ids(fillAll(base), true)).toEqual([]);
  });

  it('ticks each mission off by the change it asks for', () => {
    const start = dashboardFromPreset('two-by-two', id);
    const [resize, row, fill] = layoutMissions(start, false);
    expect(resize!.done(ctx(start, start))).toBe(false);
    const row0 = start.rows[0]!;
    const resized = {
      ...start,
      rows: [
        { ...row0, slots: row0.slots.map((s, i) => ({ ...s, span: i === 0 ? 8 : 4 })) },
        ...start.rows.slice(1),
      ],
    };
    expect(resize!.done(ctx(start, resized))).toBe(true);
    const taller = {
      ...start,
      rows: [{ ...row0, height: row0.height + 40 }, ...start.rows.slice(1)],
    };
    expect(row!.done(ctx(start, start))).toBe(false);
    expect(row!.done(ctx(start, taller))).toBe(true);
    expect(fill!.done(ctx(start, setDashboardContent(start, row0.slots[0]!.id, note)))).toBe(true);
    const lone = oneSlot(start);
    const add = layoutMissions(lone, false)[0]!;
    expect(add.done(ctx(lone, lone))).toBe(false);
    expect(add.done(ctx(lone, start))).toBe(true);
  });

  it('rings the divider, the edge, the cog and Add to Slot', () => {
    const start = dashboardFromPreset('two-by-two', id);
    const rings = layoutMissions(start, false).map((m) => m.hints[1]!.ring!());
    expect(rings).toEqual([
      '[data-dashboard] [role="separator"][aria-orientation="vertical"]',
      '[data-dashboard] [role="separator"][aria-orientation="horizontal"]',
      '[data-slot-empty] [aria-haspopup="dialog"]',
    ]);
    expect(layoutMissions(oneSlot(start), false)[0]!.hints[1]!.ring!()).toBe(
      '[data-dashboard-slot]:not([data-slot-empty]) [aria-label="Slot Settings"]',
    );
  });
});
