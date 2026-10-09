// @vitest-environment jsdom
// A screen inside an element zooms with the canvas, but stops growing past SCREEN_SCALE_MAX
// (docs/specs/008-canvas/canvas-and-palette.md "Screens inside an element").
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CanvasZoomProvider } from './CanvasZoomContext';
import { SCREEN_SCALE_MAX, ScaleCapped } from './ScaleCapped';

// Draws as the canvas would: its own size times the zoom (`drawnAt`), times the scale it sets itself.
function show(zoom: number, drawnAt = zoom) {
  const proto = HTMLElement.prototype;
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, get: () => 100 });
  proto.getBoundingClientRect = function (this: HTMLElement) {
    const own = /scale\(([\d.]+)\)/.exec(this.style.transform)?.[1];
    return { width: 100 * drawnAt * (own ? Number(own) : 1) } as DOMRect;
  };
  return render(
    <CanvasZoomProvider zoom={zoom}>
      <ScaleCapped>
        <span>Setup</span>
      </ScaleCapped>
    </CanvasZoomProvider>,
  );
}
const scaleOf = () => screen.getByText('Setup').parentElement!.style.transform;

describe('a screen inside an element', () => {
  it('zooms freely up to the cap, then stops growing', () => {
    show(1);
    expect(scaleOf()).toBe('');
  });

  it('is held at the cap when zoomed in past it', () => {
    show(3);
    const s = Number(/scale\(([\d.]+)\)/.exec(scaleOf())![1]);
    expect(3 * s).toBeCloseTo(SCREEN_SCALE_MAX);
  });

  it('leaves a maximised element (drawn at screen size) alone', () => {
    show(3, 1);
    expect(scaleOf()).toBe('');
  });
});
