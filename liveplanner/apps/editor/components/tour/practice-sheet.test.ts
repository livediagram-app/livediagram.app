// @vitest-environment jsdom

// The practice sheet (docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins"): a real Sheet seeded with the
// budget, whose store answers here and sends nothing; each run starts from the seed again.

import { describe, expect, it, vi } from 'vitest';
import { sheetMissions } from './plan-tour-steps';
import { keptSheetSeed, practiceSheetCtx, PRACTICE_TITLE, startPracticeSheet } from './practice-sheet';

const fetchSpy = vi.spyOn(globalThis, 'fetch');
const sinks = () => ({ undo: vi.fn(), toast: vi.fn() });
const ctxOf = async () => {
  const run = await startPracticeSheet('en-GB', sinks());
  const sheet = run.store.sheet(run.sheetId)!;
  const wb = run.store.workbook(run.tabId);
  return { run, sheet, ctx: practiceSheetCtx(sheet, (r, c) => wb.value(run.sheetId, r, c), false) };
};

describe('startPracticeSheet', () => {
  it('lays out the budget, its formulas worked out, titled and frozen, sending nothing', async () => {
    const { sheet, ctx } = await ctxOf();
    expect(sheet.title).toBe(PRACTICE_TITLE);
    expect(sheet.layout.frozenRows).toBe(1);
    expect(ctx.value('A1')).toBe('Category');
    expect(ctx.value('B2')).toBe(1200);
    expect(ctx.value('C4')).toBeNull();
    expect(ctx.isFormula('D2')).toBe(true);
    expect(ctx.value('D2')).toBe(0);
    expect(ctx.value('B7')).toBe(2450);
    expect(ctx.isFormula('B2')).toBe(false);
    expect(ctx.currency('B2')).toBe(false);
    expect(ctx.charted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('starts each run afresh, on a tab of its own', async () => {
    const a = await startPracticeSheet('en-GB', sinks());
    const b = await startPracticeSheet('en-GB', sinks());
    expect(a.store).toBe(b.store);
    expect(a.tabId).not.toBe(b.tabId);
    expect(b.store.sheet(b.sheetId)?.title).toBe(PRACTICE_TITLE);
  });

  it('is not done with any challenge as it starts', async () => {
    const { ctx } = await ctxOf();
    expect(sheetMissions(false).filter((m) => m.done(ctx))).toEqual([]);
  });

  it('reads a cell off the sheet as nothing', async () => {
    const { sheet } = await ctxOf();
    const off = practiceSheetCtx(sheet, () => ({ error: 'x' }), true);
    expect(off.value('Z99')).toBeNull();
    expect(off.isFormula('Z99')).toBe(false);
    expect(off.currency('Z99')).toBe(false);
    expect(off.charted).toBe(true);
  });

  it('copies the sheet as a kept seed', async () => {
    const { sheet } = await ctxOf();
    const seed = keptSheetSeed(sheet);
    expect(seed.title).toBe(PRACTICE_TITLE);
    expect(seed.rev).toBe(0);
    expect(seed.cells.length).toBeGreaterThan(10);
  });
});
