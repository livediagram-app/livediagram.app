// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Element as CanvasElement } from '@livehuddle/document';
import { tabFitView } from './tab-fit-view';
import { FIT_TO_SCREEN_PADDING } from '@liveworkspace/workbench/lib/viewport';
import { FIT_3D_NARROW_PAD, fit3DView } from '@/lib/space-3d/space-3d-fit';
import { SPACE_3D_TILT_DEG } from '@/lib/space-3d/space-3d-camera';

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
    shape: 'focus-button',
    x,
    y,
    width: 100,
    height: 50,
    label: '',
  }) as CanvasElement;

afterEach(() => document.body.replaceChildren());

describe('tabFitView', () => {
  it('fits every boxed element on the tab, as the tilted camera shows it', () => {
    const view = tabFitView(canvas(), [shape('a', 0, 0), shape('b', 900, 400)]);
    // A 400 px wide canvas is a phone's: narrow sides.
    expect(view).toEqual(
      fit3DView(
        { width: 400, height: 800 },
        { x: 0, y: 0, width: 1000, height: 450 },
        { x: FIT_3D_NARROW_PAD, y: FIT_TO_SCREEN_PADDING },
        SPACE_3D_TILT_DEG,
      ),
    );
  });

  it('goes back to the origin at 100% on an empty tab', () => {
    expect(tabFitView(canvas(), [])).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
  });

  it('is null without a canvas to measure', () => {
    expect(tabFitView(null, [shape('a', 0, 0)])).toBeNull();
  });
});
