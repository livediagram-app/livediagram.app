import { describe, expect, it, vi } from 'vitest';
import {
  canvasViewResult,
  clickableBoxes,
  pageOrFirst,
  viewBoxOf,
  viewPagesOf,
} from './app-view-tab';
import {
  PREVIEW_PICTURE_LIMITS,
  VIEW_IMAGE_BUDGET_BYTES,
  VIEW_PICTURE_LIMITS,
} from './preview-budget';

// Each product's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)": what view_tab answers beside the SVG.

describe('view_tab’s shared parts', () => {
  it('reads the SVG’s view box, and an unreadable one as empty', () => {
    expect(viewBoxOf('<svg width="1" viewBox="-12.5 -8 300 200.25">')).toEqual({
      x: -12.5,
      y: -8,
      width: 300,
      height: 200.25,
    });
    expect(viewBoxOf('<svg>')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(viewBoxOf('<svg viewBox="a b c d">')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(viewBoxOf('<svg viewBox="1 2')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('offers every boxed element, never an arrow or a box it cannot place, and only the shown page’s', () => {
    const els = [
      { id: 'pay', type: 'shape', x: 0, y: 0, width: 10, height: 10, label: ' Pay ' },
      { id: 'ship', type: 'shape', x: 20, y: 0, width: 10, height: 10, label: '' },
      { id: 'far', type: 'text', x: 500, y: 0, width: 10, height: 10, label: 7 },
      { id: 'link', type: 'arrow', x: 0, y: 0, width: 20, height: 1 },
      { id: 'odd', type: 'shape', x: 0, y: 0, width: Number.NaN, height: 1 },
    ];
    const ref = (id: string) => `#${id}`;
    expect(clickableBoxes(els, ref).map((e) => e.id)).toEqual(['pay', 'ship', 'far']);
    expect(clickableBoxes(els, ref, { x: 0, y: 0, width: 100, height: 100 })).toEqual([
      { id: 'pay', ref: '#pay', label: 'Pay', x: 0, y: 0, width: 10, height: 10 },
      { id: 'ship', ref: '#ship', label: null, x: 20, y: 0, width: 10, height: 10 },
    ]);
  });

  it('names a page by its name, or by its place', () => {
    expect(
      viewPagesOf([{ id: 'a', name: ' Cover ' }, { id: 'b' }, { id: 'c', name: '  ' }]),
    ).toEqual([
      { id: 'a', name: 'Cover' },
      { id: 'b', name: 'Page 2' },
      { id: 'c', name: 'Page 3' },
    ]);
  });

  it('shows the page asked for, or the first when it names none', () => {
    const pages = [{ id: 'a' }, { id: 'b' }];
    expect(pageOrFirst(pages, 'b')).toBe(pages[1]);
    expect(pageOrFirst(pages, 'gone')).toBe(pages[0]);
    expect(pageOrFirst(pages)).toBe(pages[0]);
    expect(pageOrFirst([], 'a')).toBeUndefined();
  });

  it('answers in one line, the SVG in structured content only', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const value = { name: 'Deck', svg: '<svg>secret art</svg>', elements: [1], pages: [1, 2] };
    const result = canvasViewResult(value);
    expect(result.content).toEqual([
      { type: 'text', text: 'Drew tab "Deck" for the interactive view.' },
    ]);
    expect(result.structuredContent).toBe(value);
    expect(info).toHaveBeenCalledWith('[mcp] view_tab', { bytes: 21, elements: 1, pages: 2 });
    canvasViewResult({ name: 'Flow', svg: '', elements: [] });
    expect(info).toHaveBeenLastCalledWith('[mcp] view_tab', { bytes: 0, elements: 0, pages: 0 });
    info.mockRestore();
  });

  it('holds the view’s pictures to a smaller budget than the PNG’s', () => {
    expect(VIEW_PICTURE_LIMITS.totalBudgetBytes).toBe(VIEW_IMAGE_BUDGET_BYTES);
    for (const key of ['maxBytesPerImage', 'totalBudgetBytes', 'totalBudgetPixels'] as const)
      expect(VIEW_PICTURE_LIMITS[key]).toBeLessThan(PREVIEW_PICTURE_LIMITS[key]);
  });
});
