// A 5 MB tab export dropped on the Import dialog (docs/specs/026-plan/plan-tabs.md "The Import dialog": a large tab
// JSON is held, not put in the box, and imported straight from the file). The page's own work on it is the route
// (its envelope's first 512 characters) and the parse a paste goes through: both within a budget, so the drop stays
// responsive. A tool's export at that size is read in the worker, not here.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { ITEMS_MAX } from '@liveplanner/items';
import { parseImportedTab } from '@/lib/import-tab';
import { DROP_INLINE_MAX_BYTES, fileSizeLabel, routeImportDrop } from './import-drop';

const FIVE_MB = 5 * 1024 * 1024;

// A Board tab's export as `tabToJsonText` writes it: the envelope, the board, then a full plan's cards (ITEMS_MAX),
// each with a title and a long description, padded to 5 MB.
function fiveMbTabExport(): string {
  const description =
    'Check the quantities against the purchase order, confirm the delivery window. '.repeat(
      Math.ceil(FIVE_MB / ITEMS_MAX / 80),
    );
  const items = Array.from({ length: ITEMS_MAX }, (_, i) => ({
    id: `item-${i}`,
    type: 'task',
    key: i + 1,
    rank: `a${i.toString(36)}`,
    fields: {
      title: `Card ${i}: follow up with the supplier about the March order`,
      status: i % 3 === 0 ? 'done' : 'todo',
      description,
    },
  }));
  return JSON.stringify(
    {
      schemaVersion: 2,
      kind: 'liveplanner.tab',
      tab: {
        id: 't1',
        name: 'Orders',
        elements: [{ id: 'b1', type: 'shape', shape: 'plan-board', x: 0, y: 0, w: 900, h: 600 }],
      },
      items,
    },
    null,
    2,
  );
}

describe('a 5 MB tab export dropped on the Import dialog', () => {
  const text = fiveMbTabExport();

  it('is held rather than put in the box', () => {
    expect(text.length).toBeGreaterThan(FIVE_MB);
    expect(text.length).toBeLessThan(6 * 1024 * 1024);
    expect(text.length).toBeGreaterThan(DROP_INLINE_MAX_BYTES);
    expect(fileSizeLabel(text.length)).toMatch(/^5\.\d MB$/);
  });

  it('is routed from its first lines, within a budget whatever its length', async () => {
    let route: Awaited<ReturnType<typeof routeImportDrop>> | undefined;
    const ms = await cpuMsOfAsync(async () => {
      route = await routeImportDrop(
        text,
        'orders.json',
        { intoTab: { kind: 'json' }, tools: true },
        () => {
          throw new Error('a tab’s JSON is never read as a tool’s');
        },
      );
    });
    expect(route).toEqual({ to: 'tab-json' });
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });

  it('parses as a paste does, within a budget', () => {
    let result: ReturnType<typeof parseImportedTab> | undefined;
    const ms = cpuMsOf(() => {
      result = parseImportedTab(text);
    });
    expect(result?.ok).toBe(true);
    expect(result?.ok && result.plan?.items.length).toBe(ITEMS_MAX);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});

describe('fileSizeLabel', () => {
  it('says KB under a megabyte, never 0, and MB to one place above', () => {
    expect(fileSizeLabel(10)).toBe('1 KB');
    expect(fileSizeLabel(840 * 1024)).toBe('840 KB');
    expect(fileSizeLabel(5.24 * 1024 * 1024)).toBe('5.2 MB');
  });
});
