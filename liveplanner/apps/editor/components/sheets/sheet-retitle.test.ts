import { describe, expect, it, vi } from 'vitest';
import { retitleSheets } from './sheet-rename';

// docs/specs/029-sheets/sheet.md "Placing a sheet": a Sheet still titled after its tab's default name follows the
// tab's rename, kept unique among the tab's sheets; one with another title, or not loaded, keeps its own.
function store(sheets: Record<string, string>) {
  const write = vi.fn();
  return {
    write,
    sheet: (id: string) =>
      id in sheets ? ({ tabId: 't', title: sheets[id] } as never) : undefined,
    titlesOn: () => Object.values(sheets),
  };
}

describe('retitleSheets', () => {
  it('renames only the sheets titled after the old name', () => {
    const s = store({ a: 'Tab 1', b: 'Budget' });
    retitleSheets(s, ['a', 'b', 'missing'], 'Tab 1', 'Launch');
    expect(s.write).toHaveBeenCalledTimes(1);
    expect(s.write).toHaveBeenCalledWith('a', { kind: 'title', title: 'Launch' });
  });

  it('keeps the new title unique on the tab', () => {
    const s = store({ a: 'Tab 1', b: 'Launch' });
    retitleSheets(s, ['a'], 'Tab 1', 'Launch');
    expect(s.write.mock.lastCall![1]).not.toHaveProperty('title', 'Launch');
  });
});
