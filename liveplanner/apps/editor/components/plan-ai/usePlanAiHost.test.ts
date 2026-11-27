import { describe, expect, it, vi } from 'vitest';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { hostInputOf } from './usePlanAiHost';
import { ITEMS, TYPES } from './plan-ai-fixtures';

// The editor's side of Plan AI's host (docs/specs/026-plan/plan-ai.md "What it may change"): the edit paths it hands
// the appliers, from the editor's context and the plan's.

const store = vi.hoisted(() => ({
  workbook: vi.fn((tabId: string) => ({ tabId })),
  writeAll: vi.fn((): string | null => null),
}));
vi.mock('@/components/sheets/sheet-store-client', () => ({
  sheetStoreOf: () => store,
  sheetRefusalMessage: (code: string) => `refused ${code}`,
}));

type Ctx = Parameters<typeof hostInputOf>[0];

function ctxOf(over: Record<string, unknown> = {}): Ctx {
  return {
    projectId: 'p1',
    activeTab: { id: 't1', name: 'Budget', kind: 'sheet', elements: [] },
    tabs: [],
    forms: { changeForm: vi.fn(), renameForm: vi.fn() },
    planTabs: { changeDashboard: vi.fn() },
    sheetsBridge: null,
    ...over,
  } as unknown as Ctx;
}

describe('hostInputOf', () => {
  it('hands a sheet its workbook and writes, a refusal in words', () => {
    const commitElements = vi.fn();
    const input = hostInputOf(
      ctxOf({ sheetsBridge: { commitElements, locale: 'en-GB' } }),
      undefined,
    );
    const sheets = input.sheets!;
    expect(sheets.workbook('t1')).toEqual({ tabId: 't1' });
    expect(store.workbook).toHaveBeenCalledWith('t1');
    expect(sheets.writeAll([])).toBeNull();
    store.writeAll.mockReturnValueOnce('sheet_full');
    expect(sheets.writeAll([])).toBe('refused sheet_full');
    expect(sheets.commitElements).toBe(commitElements);
    expect(sheets.locale).toBe('en-GB');
  });

  it('has no sheet without a bridge, no board without a plan, and a blank project id when none', () => {
    const input = hostInputOf(ctxOf({ projectId: null }), undefined);
    expect(input.sheets).toBeNull();
    expect(input.board).toBeNull();
    expect(input.projectId).toBe('');
  });

  it('takes the board from the plan and changes a dashboard as a row change', () => {
    const ctx = ctxOf();
    const plan = { items: ITEMS, types: TYPES } as unknown as PlanContextValue;
    const input = hostInputOf(ctx, plan);
    expect(input.board?.items).toBe(ITEMS);
    expect(input.board?.types).toBe(TYPES);
    const change = { rows: [] } as never;
    input.changeDashboard(change);
    expect(ctx.planTabs.changeDashboard).toHaveBeenCalledWith(change, 'DashboardRow');
  });
});
