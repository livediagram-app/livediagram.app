// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { sheetDeleteCopy, useSheetDeleteGuard } from './useSheetDeleteGuard';

// Asking before a delete takes Sheets' sheets (docs/specs/029-sheets/sheet-store.md "Deleting a sheet").

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const sheet = (id: string, sheetId: string) =>
  ({ id, type: 'shape', shape: 'plan-sheet', planSheet: { sheetId } }) as unknown as Element;
const tabs: Tab[] = [
  { id: 't1', name: 'One', elements: [sheet('e1', 'A'), sheet('e2', 'B')] } as Tab,
];

function guard(over: Partial<Parameters<typeof useSheetDeleteGuard>[0]> = {}) {
  const deps = {
    readTabs: () => tabs,
    activeTabId: 't1',
    confirm: vi.fn(async () => true),
    sheetsAttached: () => true,
    sheetTitle: (id: string) => (id === 'A' ? 'Budget' : undefined),
    releaseSheets: vi.fn(() => true),
    ...over,
  };
  const { result } = renderHook(() => useSheetDeleteGuard(deps));
  return { run: result.current, deps };
}

beforeEach(() => vi.clearAllMocks());

describe('sheetDeleteCopy', () => {
  it('names one sheet, or counts several', () => {
    expect(sheetDeleteCopy(['Budget'])).toEqual({
      title: 'Delete Sheet?',
      message: 'Budget and its cells are deleted. Undo brings it back while this page is open.',
    });
    expect(sheetDeleteCopy(['Budget', 'Sheet'])).toEqual({
      title: 'Delete 2 Sheets?',
      message:
        'Budget, Sheet and their cells are deleted. Undo brings them back while this page is open.',
    });
  });
});

describe('useSheetDeleteGuard', () => {
  it('asks once for every sheet a delete takes, then releases them', async () => {
    const { run, deps } = guard();
    const answer = await run(new Set(['e1', 'e2']));
    expect(deps.confirm).toHaveBeenCalledWith({
      ...sheetDeleteCopy(['Budget', 'Sheet']),
      confirmLabel: 'Delete',
    });
    expect(track).toHaveBeenCalledWith('Sheet', 'Deleted', 'Confirmed');
    expect(deps.releaseSheets).not.toHaveBeenCalled();
    answer!.release();
    expect(deps.releaseSheets).toHaveBeenCalledWith(['A', 'B']);
  });

  it('answers null when cancelled', async () => {
    const { run, deps } = guard({ confirm: vi.fn(async () => false) });
    expect(await run(new Set(['e1']))).toBeNull();
    expect(track).toHaveBeenCalledWith('Sheet', 'Deleted', 'Cancelled');
    expect(deps.releaseSheets).not.toHaveBeenCalled();
  });

  it('does not ask when no sheet goes, or before any Sheet has drawn', () => {
    const { run, deps } = guard();
    expect(run(new Set(['zzz']))).toBeNull();
    const early = guard({ sheetsAttached: () => false });
    expect(early.run(new Set(['e1']))).toBeNull();
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(early.deps.confirm).not.toHaveBeenCalled();
  });
});
