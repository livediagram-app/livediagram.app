import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_LOCALE,
  applySheetWrite,
  emptyLayout,
  emptySheet,
  NOBODY,
  Workbook,
  writeRows,
  type AgentValue,
  type Sheet,
} from '@liveplanner/sheets';
import type { Element } from '@liveplanner/project';
import { applySheetChanges, type SheetSink } from './plan-ai-sheet';
import { readSheet } from './plan-ai-read';

// Plan AI on a sheet (docs/specs/026-plan/plan-ai.md "On a sheet").

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function sheetOf(rows: AgentValue[][]): Sheet {
  const rand = seeded();
  const blank = emptySheet({ id: 'sh1', tabId: 't1', title: 'Budget', layout: emptyLayout(rand) });
  if (!rows.length) return blank;
  const made = writeRows(
    new Workbook({ sheets: [blank], locale: AGENT_LOCALE }),
    'sh1',
    'A1',
    rows,
    rand,
  );
  if (!made.ok) throw new Error(made.error);
  return applySheetWrite(blank, made.write, { now: 0, by: NOBODY }).sheet;
}

const ROWS: AgentValue[][] = [
  ['Item', 'Cost'],
  ['Rent', 900],
  ['Food', 300],
];

function sink(refuse: string | null = null) {
  return {
    writeAll: vi.fn<SheetSink['writeAll']>(() => refuse),
    commitElements: vi.fn<SheetSink['commitElements']>(),
  };
}

const FRAME = { x: 0, y: 0, width: 800, height: 600 };

const run = (
  changes: Record<string, unknown>[],
  s = sink(),
  opts: { frame?: typeof FRAME | null; elements?: Element[] } = {},
) =>
  applySheetChanges({
    live: new Workbook({ sheets: [sheetOf(ROWS)], locale: AGENT_LOCALE }),
    locale: AGENT_LOCALE,
    sheetId: 'sh1',
    changes: changes as never,
    dark: false,
    frame: opts.frame === undefined ? FRAME : opts.frame,
    elements: opts.elements ?? [],
    sink: s,
    rand: seeded(3),
  });

describe('applySheetChanges', () => {
  it('fills cells, a total formula and a format as one write, each built on the one before', () => {
    const s = sink();
    const out = run(
      [
        { op: 'set', at: 'A4', rows: [['Total', '=SUM(B2:B3)']] },
        { op: 'format', range: 'A4:B4', format: { bold: true } },
        { op: 'sort', by: 'B', range: 'A2:B3', descending: false },
      ],
      s,
    );
    expect(out.lines.filter((l) => !l.ok)).toEqual([]);
    expect(out.lines[0]!.text).toMatch(/^[A-Z]/);
    expect(out.steps).toBe(1);
    expect(s.writeAll).toHaveBeenCalledTimes(1);
    expect(s.writeAll.mock.calls[0]![0].length).toBeGreaterThanOrEqual(3);
    expect(s.commitElements).not.toHaveBeenCalled();
  });

  it('stops at a change that does not read or is refused, writing the ones before it', () => {
    const s = sink();
    const out = run(
      [
        { op: 'set', at: 'C1', rows: [['Note']] },
        { op: 'set', at: 'nowhere', rows: [['x']] },
        { op: 'set', at: 'D1', rows: [['y']] },
      ],
      s,
    );
    expect(out.lines.map((l) => l.ok)).toEqual([true, false]);
    expect(s.writeAll.mock.calls[0]![0]).toHaveLength(1);
    expect(run([{ op: 'paint' }]).lines[0]!.ok).toBe(false);
  });

  it('says why when the store refuses the writes, and counts no step', () => {
    const out = run([{ op: 'set', at: 'C1', rows: [['Note']] }], sink('The sheet is full'));
    expect(out.steps).toBe(0);
    expect(out.lines.at(-1)).toEqual({ ok: false, text: 'The sheet is full' });
  });

  it('places a chart over the Sheet as one more step, or says it could not without one', () => {
    const s = sink();
    const out = run([{ op: 'chart', type: 'bar', range: 'A1:B3' }], s);
    expect(out.steps).toBe(1);
    expect(s.commitElements).toHaveBeenCalledTimes(1);
    const map = s.commitElements.mock.calls[0]![0];
    expect(map([]).length).toBe(1);
    const none = run([{ op: 'chart', type: 'bar', range: 'A1:B3' }], sink(), { frame: null });
    expect(none.lines.at(-1)!.text).toMatch(/charts weren’t placed/);
  });

  it('takes the sheet’s charts off with clear_charts', () => {
    const chart = {
      id: 'ch1',
      type: 'shape',
      chartSource: { sheetId: 'sh1', range: null },
      sheetAnchor: { x: 0, y: 0 },
    } as unknown as Element;
    const s = sink();
    const out = run([{ op: 'clear_charts' }], s, { elements: [chart] });
    expect(out.steps).toBe(1);
    expect(s.commitElements.mock.calls[0]![0]([chart])).toEqual([]);
  });

  it('answers a sheet that is not open any more', () => {
    const out = applySheetChanges({
      live: new Workbook({ sheets: [], locale: AGENT_LOCALE }),
      locale: AGENT_LOCALE,
      sheetId: 'sh1',
      changes: [],
      dark: false,
      frame: null,
      elements: [],
      sink: sink(),
    });
    expect(out.lines[0]!.ok).toBe(false);
  });
});

describe('readSheet', () => {
  it('reads each cell as typed, a formula with what it shows', () => {
    const wb = new Workbook({
      sheets: [sheetOf([...ROWS, ['Total', '=SUM(B2:B3)']])],
      locale: AGENT_LOCALE,
    });
    const text = readSheet(wb, 'sh1')!;
    expect(text).toContain('Sheet "Budget"');
    expect(text).toContain('A1 Item | B1 Cost');
    expect(text).toContain('B4 =SUM(B2:B3) → 1200');
    expect(readSheet(wb, 'nope')).toBeNull();
    const empty = new Workbook({ sheets: [sheetOf([])], locale: AGENT_LOCALE });
    expect(readSheet(empty, 'sh1')).toContain('(The sheet is empty.)');
  });
});
