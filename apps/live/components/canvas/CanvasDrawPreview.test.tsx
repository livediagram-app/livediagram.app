// @vitest-environment jsdom
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createViewportStore } from '@/lib/viewport-store';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { describe, expect, it } from 'vitest';
import { CanvasDrawPreview } from './CanvasDrawPreview';

const wrapper = document.createElement('div');
// The overlay reads the view from the viewport store, at 2x here.
const render = (ui: ReactElement) =>
  rtlRender(<ViewportStoreProvider store={createViewportStore(2)}>{ui}</ViewportStoreProvider>);
const base = {
  drawDrag: null,
  polygonVertices: [],
  polygonCursor: null,
  stamp: null,
  wrapperRef: { current: wrapper },
  mainSize: { width: 1000, height: 1000 },
};

describe('CanvasDrawPreview', () => {
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
