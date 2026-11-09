import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { LOOK_CLEAR_TOP_PX, LOOK_CLEAR_TOP_PX_NARROW, look } from './diagram-look';

// Look and Feel (docs/specs/007-editor/watch-it-built.md "The curriculum"): its row of steps sits up top, clear of the
// Tab Style dialog, and the player moves to the top while the dialog is open, so the row keeps a screen distance from
// the view's top at any zoom instead of a canvas one that slid under the player when zoomed out.

const tab = { id: 't', name: 'Tab', elements: [], backgroundColor: '#0f172a' } as unknown as Tab;

const topEdgeOnScreen = (zoom: number, width = 1600, height = 1000) => {
  const centre = { x: 500, y: 400 };
  const size = { width: width / zoom, height: height / zoom };
  const { elements } = look.layout({ centre, size, tab, zoom });
  const shapes = elements.filter((e) => e.type === 'shape') as { y: number }[];
  const top = Math.min(...shapes.map((s) => s.y));
  return (top - (centre.y - size.height / 2)) * zoom;
};

describe('Look and Feel layout', () => {
  it('keeps the row the same screen distance below the top at any zoom', () => {
    for (const zoom of [0.25, 0.7, 1, 2]) {
      expect(topEdgeOnScreen(zoom)).toBeCloseTo(LOOK_CLEAR_TOP_PX, 5);
    }
  });

  it('on a phone, likewise with its own distance', () => {
    expect(topEdgeOnScreen(0.7, 390, 700)).toBeCloseTo(LOOK_CLEAR_TOP_PX_NARROW, 5);
  });

  it('takes a missing zoom as 1', () => {
    const centre = { x: 0, y: 0 };
    const size = { width: 1600, height: 1000 };
    const { elements } = look.layout({ centre, size, tab });
    const ys = (elements.filter((e) => e.type === 'shape') as { y: number }[]).map((s) => s.y);
    expect(Math.min(...ys)).toBe(-500 + LOOK_CLEAR_TOP_PX);
  });
});
