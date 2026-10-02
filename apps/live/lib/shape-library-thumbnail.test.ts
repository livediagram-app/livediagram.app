// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { libraryItemThumbnail } from './shape-library-thumbnail';

// docs/specs/013-workspace/shape-libraries.md "Using a library": a tile's thumbnail is the item drawn
// by the editor's own SVG export, as an inert image, cached per item.

const item: ShapeLibraryItem = {
  id: 'i1',
  title: 'Service',
  width: 120,
  height: 60,
  elements: [
    { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60, label: 'Svc' },
  ],
};

describe('libraryItemThumbnail', () => {
  it('draws the item as an SVG data URL', async () => {
    const url = await libraryItemThumbnail(item);
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(url)).toContain('<svg');
  });

  it('draws each item once', async () => {
    const exporter = await import('./export-tab');
    const spy = vi.spyOn(exporter, 'renderTabToSvg');
    const again = { ...item, id: 'i2' };
    await libraryItemThumbnail(again);
    await libraryItemThumbnail(again);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
