// @vitest-environment jsdom
// The Map's shared body (docs/specs/008-canvas/minimap.md "What it shows"; canvas-performance.md "The Map is one
// image"): the picture on one layer, the window and the dim on their own over it, and the presses that move the view.

import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MinimapMap, minimapPicture } from './MinimapMap';

const BOUNDS = { x: 0, y: 0, width: 1000, height: 500 };
const COLORS = { fill: 'rgba(0,0,255,0.1)', stroke: 'rgba(0,0,255,0.5)' };

// jsdom has no SVG geometry: a screen CTM that maps a client point to world space as (client × 10).
beforeEach(() => {
  const ctm = {
    inverse: () => ctm,
  };
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ctm,
    createSVGPoint: () => {
      const pt = {
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: pt.x * 10, y: pt.y * 10 }),
      };
      return pt;
    },
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  });
});
afterEach(() => {
  for (const key of [
    'getScreenCTM',
    'createSVGPoint',
    'setPointerCapture',
    'releasePointerCapture',
  ])
    delete (SVGElement.prototype as unknown as Record<string, unknown>)[key];
});

function mount(over: Partial<Parameters<typeof MinimapMap>[0]> = {}) {
  const setViewportOffset = vi.fn();
  const setViewportZoom = vi.fn();
  const utils = render(
    <MinimapMap
      picture={minimapPicture(BOUNDS, '<rect/>').picture}
      bounds={BOUNDS}
      size="medium"
      viewportOffset={{ x: 0, y: 0 }}
      viewportZoom={1}
      setViewportOffset={setViewportOffset}
      setViewportZoom={setViewportZoom}
      zoomMin={0.1}
      zoomMax={4}
      mainSize={{ width: 800, height: 600 }}
      paperColor="#fff"
      dimOutside
      dark={false}
      viewColors={COLORS}
      {...over}
    />,
  );
  const map = utils.container.querySelector('svg[role="img"]')!;
  const view = utils.container.querySelector('svg[data-minimap-view]')!;
  return { ...utils, map, view, setViewportOffset, setViewportZoom };
}

describe('minimapPicture', () => {
  it('maps nothing without content', () => {
    expect(minimapPicture(null, '')).toEqual({ picture: null, bounds: null });
  });

  it('is one image over the padded content box', () => {
    const { picture, bounds } = minimapPicture(BOUNDS, '<rect/>');
    expect(bounds).toBe(BOUNDS);
    // 12% of each side plus 48 px.
    expect(picture).toMatchObject({ x: -168, y: -108, width: 1336, height: 716 });
    expect(decodeURIComponent(picture!.href)).toContain('<rect/></svg>');
  });
});

describe('MinimapMap', () => {
  it('draws the picture on one layer and the window and dim on another over it', () => {
    const { map, view } = mount();
    expect(map.querySelectorAll('image')).toHaveLength(1);
    expect(map.querySelector('rect, path')).toBeNull();
    expect(view.getAttribute('viewBox')).toBe(map.getAttribute('viewBox'));
    expect(view.getAttribute('aria-hidden')).toBe('true');
    expect(view.getAttribute('class')).toContain('pointer-events-none');
    expect(view.querySelector(`rect[stroke="${COLORS.stroke}"]`)).not.toBeNull();
    expect(view.querySelector('path')?.getAttribute('class')).toBe('fill-slate-500/25');
  });

  it('veils dark paper in black, and leaves the dim out when it is off', () => {
    expect(mount({ dark: true }).view.querySelector('path')?.getAttribute('class')).toBe(
      'fill-black/45',
    );
    expect(mount({ dimOutside: false }).view.querySelector('path')).toBeNull();
  });

  it('draws no window when the view is off the map, and no picture without one', () => {
    const { view, map } = mount({ viewportOffset: { x: 50_000, y: 0 }, picture: null });
    expect(view.childElementCount).toBe(0);
    expect(map.querySelector('image')).toBeNull();
  });

  it('reads an unset zoom as 1', () => {
    const rect = mount({ viewportZoom: 0 }).view.querySelector('rect')!;
    expect(Number(rect.getAttribute('width'))).toBe(800);
  });

  it('grows the viewBox on the short axis to the panel shape', () => {
    // A tall board in a short panel grows sideways; a wide one in a tall panel grows up and down.
    const tall = mount({ bounds: { x: 0, y: 0, width: 100, height: 1000 }, size: 'short' });
    const [, , w1 = 0, h1 = 1] = tall.map.getAttribute('viewBox')!.split(' ').map(Number);
    expect(w1 / h1).toBeCloseTo(256 / 96);
    const wide = mount({ size: 'tall' });
    const [, , w2 = 0, h2 = 1] = wide.map.getAttribute('viewBox')!.split(' ').map(Number);
    expect(w2 / h2).toBeCloseTo(256 / 224);
  });

  it('jumps the view to a press and follows a drag, then stops', () => {
    const { map, setViewportOffset } = mount();
    fireEvent.pointerDown(map, { clientX: 10, clientY: 20, pointerId: 1 });
    expect(setViewportOffset).toHaveBeenLastCalledWith({ x: 400 - 100, y: 300 - 200 });
    fireEvent.pointerMove(map, { clientX: 30, clientY: 20, pointerId: 1 });
    expect(setViewportOffset).toHaveBeenLastCalledWith({ x: 400 - 300, y: 300 - 200 });
    fireEvent.pointerUp(map, { pointerId: 1 });
    fireEvent.pointerMove(map, { clientX: 50, clientY: 20, pointerId: 1 });
    expect(setViewportOffset).toHaveBeenCalledTimes(2);
  });

  it('writes nothing for a press on where the view already is', () => {
    const { map, setViewportOffset } = mount({ viewportOffset: { x: 300, y: 100 } });
    fireEvent.pointerDown(map, { clientX: 10, clientY: 20, pointerId: 1 });
    expect(setViewportOffset).not.toHaveBeenCalled();
  });

  it('zooms on a scroll, kept to the range, and ignores presses before the canvas is measured', () => {
    const { map, setViewportZoom } = mount({ viewportZoom: 3.9 });
    fireEvent.wheel(map, { clientX: 10, clientY: 20, deltaY: -400 });
    expect(setViewportZoom).toHaveBeenLastCalledWith(4);
    const unmeasured = mount({ mainSize: { width: 0, height: 0 } });
    fireEvent.wheel(unmeasured.map, { deltaY: 100 });
    fireEvent.pointerDown(unmeasured.map, { pointerId: 1 });
    expect(unmeasured.setViewportZoom).not.toHaveBeenCalled();
    expect(unmeasured.setViewportOffset).not.toHaveBeenCalled();
  });
});
