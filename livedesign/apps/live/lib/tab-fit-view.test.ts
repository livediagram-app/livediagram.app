// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Element as CanvasElement } from '@livedesign/design';
import { tabFitView } from './tab-fit-view';
import { computeFitToScreen } from '@liveworkspace/workbench/lib/viewport';

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

  it('keeps clear of a standing palette tray under the strip, as a framed page does', () => {
    const boxed = (attrs: Record<string, string>, top: number, bottom: number) => {
      const node = document.createElement('div');
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      node.getBoundingClientRect = () =>
        ({ left: 0, right: 400, width: 400, top, bottom, height: bottom - top }) as DOMRect;
      document.body.append(node);
      return node;
    };
    const elements = [shape('a', 0, 0), shape('b', 900, 400)];
    const c = canvas();
    boxed({ 'data-toolbar-palette': '' }, 10, 60);
    const stripOnly = tabFitView(c, elements)!;
    const tray = boxed({ 'data-palette-tray': '', 'data-yields-to-mode': '' }, 66, 160);
    const withTray = tabFitView(c, elements)!;
    expect(withTray.zoom).toBeLessThan(stripOnly.zoom);
    tray.remove();
    expect(tabFitView(c, elements)).toEqual(stripOnly);
  });
});
