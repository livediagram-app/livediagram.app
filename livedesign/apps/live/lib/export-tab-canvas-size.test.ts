// @vitest-environment jsdom
// The PNG's pixel size (docs/specs/007-editor/wireframe-pages.md "The Inspect panel": a picture cut to the element's
// own box). A box of 360.5 x 55.9 came out 360 x 55 pixels: the canvas was sized down to whole pixels, so the
// element's last part-pixel row and column, its border and corners there, were cut off.
import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedesign/design';
import { MAX_EXPORT_CANVAS_SIDE, renderTabToCanvas } from './export-tab';

const tab = (width: number, height: number): Tab => ({
  id: 'tab-1',
  name: 'My Tab',
  elements: [{ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width, height }],
});

describe('renderTabToCanvas size', () => {
  it('rounds a part pixel up, so nothing of the element is cut off', async () => {
    const one = await renderTabToCanvas(tab(360.5, 55.9), { scale: 1, padding: 0 });
    expect([one.width, one.height]).toEqual([361, 56]);
    const three = await renderTabToCanvas(tab(360.5, 55.92), { scale: 3, padding: 0 });
    expect([three.width, three.height]).toEqual([1082, 168]);
  });

  it('keeps whole sizes whole and never passes the canvas limit', async () => {
    const whole = await renderTabToCanvas(tab(100, 80), { scale: 2, padding: 0 });
    expect([whole.width, whole.height]).toEqual([200, 160]);
    const huge = await renderTabToCanvas(tab(40000.3, 10), { scale: 2, padding: 0 });
    expect(huge.width).toBeLessThanOrEqual(MAX_EXPORT_CANVAS_SIDE);
  });
});
