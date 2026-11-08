// @vitest-environment jsdom
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { describe, expect, it } from 'vitest';
import { CanvasDrawPreview } from './CanvasDrawPreview';

// docs/specs/023-draw-mode/draw-mode.md "Shapes": what you see while drawing is what lands.
const wrapper = document.createElement('div');
// The overlay reads the view from the viewport store, at 2x here.
const render = (ui: ReactElement) =>
  rtlRender(<ViewportStoreProvider store={createViewportStore(2)}>{ui}</ViewportStoreProvider>);
const base = {
  drawDrag: null,
  polygonVertices: [],
  polygonCursor: null,
  wrapperRef: { current: wrapper },
  mainSize: { width: 1000, height: 1000 },
  whiteboardInk: '#1c1917',
};
describe('CanvasDrawPreview on a whiteboard', () => {
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
