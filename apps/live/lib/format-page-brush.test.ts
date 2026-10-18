import { describe, expect, it } from 'vitest';
import {
  brushPageId,
  formatBannerMessage,
  pageBrush,
  pageBrushPreview,
  pagePaintPress,
} from './format-page-brush';

// docs/specs/007-editor/pages-mode.md "Copying a background": the Format tool's page brush.

describe('the page brush', () => {
  it('holds a page, and reads none from an element or an empty brush', () => {
    expect(brushPageId(pageBrush('page-1a2b3c4d'))).toBe('page-1a2b3c4d');
    expect(brushPageId('el-42')).toBeNull();
    expect(brushPageId(null)).toBeNull();
  });
});

describe('pagePaintPress', () => {
  it('arms the page pressed when the brush is empty', () => {
    expect(pagePaintPress(null, 'p1', true)).toEqual({ next: pageBrush('p1'), paint: null });
  });

  it('paints another page, keeping the brush or emptying it after one', () => {
    expect(pagePaintPress(pageBrush('p1'), 'p2', true)).toEqual({
      next: pageBrush('p1'),
      paint: { from: 'p1', to: 'p2' },
    });
    expect(pagePaintPress(pageBrush('p1'), 'p2', false)).toEqual({
      next: null,
      paint: { from: 'p1', to: 'p2' },
    });
  });

  it('paints nothing on the source page or under an element brush, the brush kept', () => {
    expect(pagePaintPress(pageBrush('p1'), 'p1', false)).toEqual({
      next: pageBrush('p1'),
      paint: null,
    });
    expect(pagePaintPress('el-1', 'p2', true)).toEqual({ next: 'el-1', paint: null });
  });
});

describe('formatBannerMessage', () => {
  it('asks for a base, naming pages in Pages', () => {
    expect(formatBannerMessage(null, false)).toBe('Select a base element to copy its style');
    expect(formatBannerMessage(null, true)).toBe('Select a base element or page to copy its style');
  });

  it('invites the targets the brush paints', () => {
    expect(formatBannerMessage('el-1', true)).toBe('Tap elements to paint this style onto them');
    expect(formatBannerMessage(pageBrush('p1'), true)).toBe(
      'Tap pages to paint this background onto them',
    );
  });
});

describe('pageBrushPreview', () => {
  it('names the page and draws its fill', () => {
    expect(
      pageBrushPreview({ index: 3, background: { fill: { kind: 'solid', color: '#15803d' } } }),
    ).toEqual({
      name: 'Page 4 background',
      fill: '#15803d',
      summary: 'Copies: background and pattern',
    });
    expect(
      pageBrushPreview({
        index: 0,
        name: 'The Beta',
        background: { fill: { kind: 'gradient', from: '#1e1b4b' } },
      }).name,
    ).toBe('The Beta background');
    expect(pageBrushPreview({ index: 0 }).fill).toBe('#ffffff');
  });
});
