// @vitest-environment jsdom
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { describe, expect, it } from 'vitest';
import type { PendingDraw } from '@/lib/draw-mode';
import { CanvasDrawPreview } from './CanvasDrawPreview';

// docs/specs/023-draw-mode/drawing-tools.md "Markers": what you see while drawing is what lands.
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
};

describe('CanvasDrawPreview for a marker', () => {
  it('leaves the marker\u2019s stroke to the canvas layer: nothing in the overlay', () => {
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
    // The arrow renderer draws the one that lands (DrawnArrowPreview); no stand-in line here.
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'arrow', ends: 'to' }}
      />,
    );
    expect(container.querySelector('svg, line, path')).toBeNull();
  });
});
