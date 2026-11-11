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
};
describe('CanvasDrawPreview draw-to-size box', () => {
  it('previews a drawn shape as a dashed box at the zoom', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 40 }}
        pendingDraw={{ type: 'shape', kind: 'rug' }}
      />,
    );
    const box = container.querySelector('.border-dashed') as HTMLElement;
    expect(box).not.toBeNull();
    const outer = box.parentElement as HTMLElement;
    expect(outer.style.width).toBe('100px');
    expect(outer.style.height).toBe('80px');
  });

  it('draws no box for a placed piece, which previews itself', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 40 }}
        pendingDraw={{ type: 'shape', kind: 'chair' }}
      />,
    );
    expect(container.querySelector('.border-dashed')).toBeNull();
  });
});
