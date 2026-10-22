// @vitest-environment jsdom
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createViewportStore } from '@/lib/viewport-store';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { describe, expect, it } from 'vitest';
import type { PendingDraw } from '@/lib/draw-mode';
import { CanvasDrawPreview } from './CanvasDrawPreview';

// docs/specs/023-draw-mode/draw-mode.md "Pens": what you see while drawing is what lands.
const wrapper = document.createElement('div');
// The overlay reads the view from the viewport store, at 2x here.
const render = (ui: ReactElement) =>
  rtlRender(<ViewportStoreProvider store={createViewportStore(2)}>{ui}</ViewportStoreProvider>);
const base = {
  drawDrag: null,
  penPoints: null,
  polygonVertices: [],
  polygonCursor: null,
  stamp: null,
  wrapperRef: { current: wrapper },
  mainSize: { width: 1000, height: 1000 },
  whiteboardInk: '#1c1917',
};
const pen: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 1.5,
  recognise: false,
};

describe('CanvasDrawPreview on a whiteboard', () => {
  it('leaves the whiteboard pen\u2019s stroke to the canvas layer: nothing in the overlay', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        penPoints={[
          { x: 0, y: 0 },
          { x: 20, y: 10 },
        ]}
        pendingDraw={pen}
      />,
    );
    expect(container.querySelector('path')).toBeNull();
  });

  it('leaves a line or an arrow to the canvas layer: nothing in the overlay', () => {
    // docs/specs/023-draw-mode/draw-mode.md "Shapes": the arrow renderer draws the one that lands
    // (DrawnArrowPreview); no stand-in line here, on any tab.
    for (const board of [true, undefined] as const) {
      const { container, unmount } = render(
        <CanvasDrawPreview
          {...base}
          drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
          pendingDraw={{ type: 'arrow', ends: 'to', ...(board ? { board } : {}) }}
        />,
      );
      expect(container.querySelector('svg, line, path')).toBeNull();
      unmount();
    }
  });

  it('previews a rectangle with a solid outline in the ink and no fill', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'shape', kind: 'square', board: true }}
      />,
    );
    const box = container.querySelector('[data-pen-preview]') as HTMLElement;
    expect(box.style.borderStyle).toBe('solid');
    expect(box.style.borderColor).toBe('rgb(28, 25, 23)');
    expect(box.style.backgroundColor).toBe('');
  });
});

describe('CanvasDrawPreview rectangle corners', () => {
  it('rounds a pen rectangle as the committed one is, at the zoom', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'shape', kind: 'square', board: true }}
      />,
    );
    const box = container.querySelector('[data-pen-preview]') as HTMLElement;
    expect(box.style.borderRadius).toBe('16px');
  });
});
