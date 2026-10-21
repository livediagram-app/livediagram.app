import { describe, expect, it, vi } from 'vitest';
import { createShape, type Tab } from '@liveplanner/document';

// A Sheet tab's preview shows every filled cell, as the tab does (docs/specs/015-api/mcp-server.md §5): its sheet is
// read once, sizes the image and is handed on for the drawing.
const SHEET = {
  id: 'sh1',
  tabId: 't',
  title: 'Deals',
  layout: {
    rows: Array.from({ length: 40 }, (_, i) => `r${i}`),
    cols: Array.from({ length: 14 }, (_, i) => `c${i}`),
  },
  cells: [{ r: 'r29', c: 'c11', i: { n: 1 } }],
};
const apiJson = vi.fn(async (_env: unknown, _token: string, path: string) => {
  if (path.includes('/sheets?ids=sh1')) return { sheets: [SHEET] };
  throw new Error('unexpected');
});
vi.mock('./api', () => ({ apiJson: (...a: [unknown, string, string]) => apiJson(...a) }));
const { planPreviewFor } = await import('./plan-preview');

const tab: Tab = {
  id: 't',
  name: 'Deals',
  kind: 'sheet',
  elements: [{ ...createShape('plan-sheet', 0, 0), id: 'el', planSheet: { sheetId: 'sh1' } }],
};
const auth = { env: {} as never, token: 'x', documentId: 'd' };

describe('a Sheet tab’s preview', () => {
  it('grows its Sheet to its filled cells and hands the sheet on', async () => {
    const preview = (await planPreviewFor(tab, auth))!;
    // Twelve columns of 120 px past 46 px of row heads, and thirty-one rows of 28 px under 62 px of chrome.
    expect(preview.tab.elements[0]).toMatchObject({ width: 46 + 13 * 120, height: 62 + 31 * 28 });
    expect(preview.sheets?.map((s) => s.id)).toEqual(['sh1']);
  });

  it('keeps its size when the sheet cannot be read', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'));
    const preview = (await planPreviewFor(tab, auth))!;
    expect(preview.tab.elements[0]).toMatchObject({ width: 960, height: 560 });
    expect(preview.sheets).toBeUndefined();
  });
});
