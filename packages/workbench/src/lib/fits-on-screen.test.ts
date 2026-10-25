// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FIT_SLACK_PX, fitsOnCanvas, rectFitsWithin } from './fits-on-screen';

// docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)": a finger moves an element only when all of it is in view.
const screen = { left: 0, top: 0, right: 400, bottom: 800 };

describe('rectFitsWithin', () => {
  it('fits an element wholly inside the screen, and one fitted edge to edge', () => {
    expect(rectFitsWithin({ left: 10, top: 10, right: 100, bottom: 100 }, screen)).toBe(true);
    expect(rectFitsWithin(screen, screen)).toBe(true);
  });

  it('allows the sub-pixel slack, and no more', () => {
    const edge = { left: -FIT_SLACK_PX, top: 0, right: 400 + FIT_SLACK_PX, bottom: 800 };
    expect(rectFitsWithin(edge, screen)).toBe(true);
    expect(rectFitsWithin({ ...edge, left: -FIT_SLACK_PX - 0.5 }, screen)).toBe(false);
  });

  it.each([
    ['left', { left: -20, top: 10, right: 100, bottom: 100 }],
    ['top', { left: 10, top: -20, right: 100, bottom: 100 }],
    ['right', { left: 10, top: 10, right: 420, bottom: 100 }],
    ['bottom', { left: 10, top: 10, right: 100, bottom: 820 }],
  ])('does not fit an element running off the %s edge', (_edge, rect) => {
    expect(rectFitsWithin(rect, screen)).toBe(false);
  });

  it('does not fit an element bigger than the screen on every side', () => {
    expect(rectFitsWithin({ left: -50, top: -50, right: 450, bottom: 850 }, screen)).toBe(false);
  });
});

describe('fitsOnCanvas', () => {
  const rect = (r: { left: number; top: number; right: number; bottom: number }) =>
    ({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }) as DOMRect;

  it('measures the node against the canvas surface it sits on', () => {
    const surface = document.createElement('main');
    surface.setAttribute('data-canvas-root', '');
    const node = document.createElement('div');
    surface.append(node);
    surface.getBoundingClientRect = () => rect(screen);
    node.getBoundingClientRect = () => rect({ left: 10, top: 10, right: 100, bottom: 100 });
    expect(fitsOnCanvas(node)).toBe(true);
    node.getBoundingClientRect = () => rect({ left: -10, top: 10, right: 500, bottom: 100 });
    expect(fitsOnCanvas(node)).toBe(false);
  });

  it('counts an unmeasurable element as fitting, so a drag is never lost', () => {
    expect(fitsOnCanvas(null)).toBe(true);
    expect(fitsOnCanvas(document.createElement('div'))).toBe(true);
  });
});
