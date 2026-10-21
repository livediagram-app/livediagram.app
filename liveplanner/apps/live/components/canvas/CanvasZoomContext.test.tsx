// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CanvasZoomProvider, CounterScaled } from './CanvasZoomContext';

// docs/specs/008-canvas/canvas-performance.md: a counter-scaled part keeps its size on screen, and it
// alone reads the zoom, so the element around it does not render for a zoom.

describe('CounterScaled', () => {
  it('scales its content by the inverse of the zoom, keeping its own props', () => {
    const { container } = render(
      <CanvasZoomProvider zoom={2}>
        <CounterScaled className="pill" data-x="1">
          hi
        </CounterScaled>
      </CanvasZoomProvider>,
    );
    const div = container.querySelector('div.pill') as HTMLDivElement;
    expect(div.style.transform).toBe('scale(0.5)');
    expect(div.dataset.x).toBe('1');
    expect(div.textContent).toBe('hi');
  });
});
