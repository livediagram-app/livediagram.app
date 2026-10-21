// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Element as CanvasElement } from '@liveplanner/document';
import { tabFitView } from './tab-fit-view';
import { computeFitToScreen } from './viewport';

// The view Fit to Screen and a double-tap's fit back out both land on (docs/specs/008-canvas/canvas-and-palette.md
// "Double-tap to zoom").

const canvas = () => {
  const node = document.createElement('main');
  node.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 400, bottom: 800, width: 400, height: 800 }) as DOMRect;
  document.body.append(node);
  return node;
};
const shape = (id: string, x: number, y: number) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 100,
    height: 50,
    label: '',
  }) as CanvasElement;

afterEach(() => document.body.replaceChildren());

describe('tabFitView', () => {
  it('fits every boxed element on the tab', () => {
    const view = tabFitView(canvas(), [shape('a', 0, 0), shape('b', 900, 400)]);
    expect(view).toEqual(
      computeFitToScreen({ width: 400, height: 800 }, { x: 0, y: 0, width: 1000, height: 450 }),
    );
  });

  it('goes back to the origin at 100% on an empty tab', () => {
    expect(tabFitView(canvas(), [])).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
  });

  it('is null without a canvas to measure', () => {
    expect(tabFitView(null, [shape('a', 0, 0)])).toBeNull();
  });
});
